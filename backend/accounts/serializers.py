from rest_framework import serializers
from core.models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name',
                  'role', 'student_roll_no', 'phone')

    def validate(self, data):
        # Public sign-up is for students only; staff and admins are created by an admin.
        if data.get('role', User.Role.STUDENT) != User.Role.STUDENT:
            raise serializers.ValidationError({'role': 'Only student accounts can self-register.'})
        data['role'] = User.Role.STUDENT
        if not data.get('student_roll_no'):
            raise serializers.ValidationError({'student_roll_no': 'Required for students.'})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    assigned_food_points = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'student_roll_no', 'phone', 'is_active',
                  'assigned_food_points')
        read_only_fields = ('id', 'username', 'role', 'student_roll_no', 'is_active')

    def get_assigned_food_points(self, obj):
        if obj.role == User.Role.STAFF:
            return [
                {
                    'id': a.food_point.id,
                    'name': a.food_point.name,
                    'point_type': a.food_point.point_type,
                    'location_description': a.food_point.location_description
                }
                for a in obj.assignments.filter(is_active=True).select_related('food_point')
            ]
        return []


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for admin user lists."""
    full_name = serializers.CharField(read_only=True)
    assigned_food_points = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'full_name', 'role', 'student_roll_no', 'phone', 'is_active', 'assigned_food_points')

    def get_assigned_food_points(self, obj):
        if obj.role == User.Role.STAFF:
            return [
                {'id': a.food_point.id, 'name': a.food_point.name}
                for a in obj.assignments.filter(is_active=True).select_related('food_point')
            ]
        return []

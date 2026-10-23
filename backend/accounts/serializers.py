from rest_framework import serializers
from core.models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name',
                  'role', 'student_roll_no', 'phone')

    def validate(self, data):
        if data.get('role') == User.Role.STUDENT and not data.get('student_roll_no'):
            raise serializers.ValidationError({'student_roll_no': 'Required for students.'})
        if data.get('role') != User.Role.STUDENT:
            data['student_roll_no'] = None
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'student_roll_no', 'phone', 'is_active')
        read_only_fields = ('id', 'username', 'role')


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for admin user lists."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'full_name', 'role', 'student_roll_no', 'is_active')

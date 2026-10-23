from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from core.models import User
from .serializers import RegisterSerializer, UserSerializer, UserListSerializer


class RegisterView(generics.CreateAPIView):
    """Public endpoint — create a new user account."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class ProfileView(APIView):
    """Get or update the authenticated user's profile."""

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserListView(generics.ListAPIView):
    """Admin-only: list all users."""
    serializer_class = UserListSerializer

    def get_queryset(self):
        qs = User.objects.all().order_by('role', 'username')
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role.upper())
        return qs

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsAdminRole()]


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == User.Role.ADMIN


class IsStaffRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in (User.Role.STAFF, User.Role.ADMIN)

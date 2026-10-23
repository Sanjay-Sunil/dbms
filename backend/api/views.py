from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q, F
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import FoodPoint, Ingredient, StaffAssignment, User
from menu.models import MenuItem, MenuRecipe
from inventory.models import InventoryStock, StockMovement
from sales.models import Sale, SaleItem
from mess.models import MessMealSession, MessMealRecord
from accounts.views import IsAdminRole, IsStaffRole

from .serializers import (
    FoodPointSerializer, IngredientSerializer, StaffAssignmentSerializer,
    MenuItemSerializer, MenuItemListSerializer,
    InventoryStockSerializer, StockMovementSerializer,
    SaleSerializer, SaleCreateSerializer, SaleItemSerializer,
    MessMealSessionSerializer, MessMealSessionListSerializer,
    MessMealRecordSerializer,
)


# ── Food Points ───────────────────────────────────

class FoodPointListView(generics.ListAPIView):
    """Public: list all active food points."""
    queryset = FoodPoint.objects.filter(is_active=True).order_by('id')
    serializer_class = FoodPointSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


class FoodPointDetailView(generics.RetrieveAPIView):
    queryset = FoodPoint.objects.all()
    serializer_class = FoodPointSerializer
    permission_classes = [permissions.IsAuthenticated]


class IngredientListView(generics.ListAPIView):
    queryset = Ingredient.objects.filter(is_active=True).order_by('ingredient_name')
    serializer_class = IngredientSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


# ── Menu ──────────────────────────────────────────

class MenuItemListView(generics.ListAPIView):
    """Browse menu items, optionally filtered by food_point and category."""
    serializer_class = MenuItemListSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = MenuItem.objects.filter(is_available=True).select_related('food_point')
        fp = self.request.query_params.get('food_point')
        cat = self.request.query_params.get('category')
        if fp:
            qs = qs.filter(food_point_id=fp)
        if cat:
            qs = qs.filter(category__iexact=cat)
        return qs.order_by('food_point__name', 'category', 'item_name')


class MenuItemDetailView(generics.RetrieveAPIView):
    queryset = MenuItem.objects.select_related('food_point').prefetch_related('recipes__ingredient')
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticated]


class MenuItemAdminView(generics.ListCreateAPIView):
    """Admin/Staff: full menu CRUD."""
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    def get_queryset(self):
        return MenuItem.objects.select_related('food_point').prefetch_related('recipes__ingredient')


class MenuItemAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]


# ── Inventory ─────────────────────────────────────

class InventoryStockListView(generics.ListAPIView):
    """Staff: view stock levels at a food point."""
    serializer_class = InventoryStockSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]
    pagination_class = None

    def get_queryset(self):
        qs = InventoryStock.objects.select_related('food_point', 'ingredient')
        fp = self.request.query_params.get('food_point')
        if fp:
            qs = qs.filter(food_point_id=fp)
        low_only = self.request.query_params.get('low_only')
        if low_only:
            qs = qs.filter(quantity_on_hand__lte=F('reorder_level'))
        return qs.order_by('food_point__name', 'ingredient__ingredient_name')


class StockMovementCreateView(generics.CreateAPIView):
    """Staff: record a stock movement (restock, adjustment, waste)."""
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    def perform_create(self, serializer):
        movement = serializer.save(recorded_by=self.request.user)
        # Update inventory stock
        stock, _ = InventoryStock.objects.get_or_create(
            food_point=movement.food_point,
            ingredient=movement.ingredient,
            defaults={'quantity_on_hand': 0, 'reorder_level': 0}
        )
        stock.quantity_on_hand += movement.quantity_change
        if stock.quantity_on_hand < 0:
            stock.quantity_on_hand = Decimal('0')
        stock.save()


# ── Sales ─────────────────────────────────────────

class SaleListView(generics.ListAPIView):
    """Staff/Admin: list sales. Students see only their own purchases."""
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Sale.objects.select_related('food_point', 'recorded_by', 'student_user').prefetch_related('items__menu_item')

        if user.role == User.Role.STUDENT:
            qs = qs.filter(student_user=user)
        elif user.role == User.Role.STAFF:
            assigned_fps = StaffAssignment.objects.filter(
                staff_user=user, is_active=True
            ).values_list('food_point_id', flat=True)
            qs = qs.filter(food_point_id__in=assigned_fps)

        fp = self.request.query_params.get('food_point')
        if fp:
            qs = qs.filter(food_point_id=fp)
        return qs.order_by('-sale_datetime')


class SaleCreateView(APIView):
    """Staff: record a new counter sale with items in one transaction."""
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    @transaction.atomic
    def post(self, request):
        ser = SaleCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        food_point = FoodPoint.objects.get(pk=data['food_point_id'])

        # Verify staff assignment
        if request.user.role == User.Role.STAFF:
            if not StaffAssignment.objects.filter(
                staff_user=request.user, food_point=food_point, is_active=True
            ).exists():
                return Response({'error': 'Not assigned to this food point'},
                                status=status.HTTP_403_FORBIDDEN)

        student = None
        if data.get('student_user_id'):
            student = User.objects.get(pk=data['student_user_id'])

        sale = Sale.objects.create(
            food_point=food_point,
            recorded_by=request.user,
            student_user=student,
            payment_method=data['payment_method'],
            notes=data.get('notes', ''),
        )

        total = Decimal('0')
        for item_data in data['items']:
            menu_item = MenuItem.objects.get(pk=item_data['menu_item_id'])
            qty = int(item_data['quantity'])
            unit_price = menu_item.current_price

            SaleItem.objects.create(
                sale=sale,
                menu_item=menu_item,
                quantity=qty,
                unit_price=unit_price,
            )
            total += unit_price * qty

            # Deduct inventory via recipes
            for recipe in menu_item.recipes.select_related('ingredient'):
                deduction = recipe.quantity_required * qty
                stock, _ = InventoryStock.objects.get_or_create(
                    food_point=food_point,
                    ingredient=recipe.ingredient,
                    defaults={'quantity_on_hand': 0, 'reorder_level': 0}
                )
                stock.quantity_on_hand = max(Decimal('0'), stock.quantity_on_hand - deduction)
                stock.save()

                StockMovement.objects.create(
                    food_point=food_point,
                    ingredient=recipe.ingredient,
                    movement_type=StockMovement.MovementType.SALE_CONSUMPTION,
                    quantity_change=-deduction,
                    sale=sale,
                    recorded_by=request.user,
                )

        sale.total_amount = total
        sale.save()

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)


# ── Mess ──────────────────────────────────────────

class MessSessionListView(generics.ListAPIView):
    """List mess meal sessions."""
    serializer_class = MessMealSessionListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = MessMealSession.objects.select_related('food_point')
        fp = self.request.query_params.get('food_point')
        if fp:
            qs = qs.filter(food_point_id=fp)
        return qs.order_by('-session_date', 'meal_type')


class MessSessionDetailView(generics.RetrieveAPIView):
    queryset = MessMealSession.objects.prefetch_related('records__student_user')
    serializer_class = MessMealSessionSerializer
    permission_classes = [permissions.IsAuthenticated]


class MessSessionCreateView(generics.CreateAPIView):
    serializer_class = MessMealSessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MessRecordCreateView(generics.CreateAPIView):
    serializer_class = MessMealRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class StudentMessHistoryView(generics.ListAPIView):
    """Student: view own mess meal history."""
    serializer_class = MessMealRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return MessMealRecord.objects.filter(
            student_user=self.request.user
        ).select_related('session__food_point').order_by('-session__session_date')


# ── Reports ───────────────────────────────────────

class ReportSalesByFoodPointView(APIView):
    """Admin: sales summary by food point."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        data = FoodPoint.objects.annotate(
            sale_count=Count('sales', filter=Q(sales__payment_status='PAID')),
            paid_sales=Sum('sales__total_amount', filter=Q(sales__payment_status='PAID')),
        ).values('id', 'name', 'sale_count', 'paid_sales').order_by('-paid_sales')

        for row in data:
            row['paid_sales'] = row['paid_sales'] or 0

        return Response(list(data))


class ReportLowStockView(APIView):
    """Admin/Staff: low stock items."""
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    def get(self, request):
        low = InventoryStock.objects.filter(
            quantity_on_hand__lte=F('reorder_level')
        ).select_related('food_point', 'ingredient').values(
            'food_point__name', 'ingredient__ingredient_name',
            'ingredient__unit_of_measure', 'quantity_on_hand', 'reorder_level'
        )
        return Response(list(low))

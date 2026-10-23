from decimal import Decimal
from django.db import connection, transaction
from django.db.models import Case, Count, F, ProtectedError, Q, Sum, When
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, permissions, status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
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


def _can_operate(user, food_point):
    """Admins may act anywhere; staff only at their actively assigned food points."""
    if user.role == User.Role.ADMIN:
        return True
    return StaffAssignment.objects.filter(
        staff_user=user, food_point=food_point, is_active=True
    ).exists()


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
        qs = (MenuItem.objects.filter(is_available=True).select_related('food_point')
              .annotate(recipe_count=Count('recipes')))
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

    def perform_destroy(self, instance):
        # sale_item -> menu_item is ON DELETE RESTRICT: sold items keep their history.
        try:
            instance.delete()
        except ProtectedError:
            raise Conflict('This item has sales history and cannot be deleted. '
                           'Mark it unavailable instead.')


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

    @transaction.atomic
    def perform_create(self, serializer):
        data = serializer.validated_data
        food_point, ingredient = data['food_point'], data['ingredient']
        movement_type, change = data['movement_type'], data['quantity_change']

        if not _can_operate(self.request.user, food_point):
            raise PermissionDenied('Not assigned to this food point.')
        if change == 0:
            raise ValidationError({'quantity_change': 'Must be non-zero.'})
        if movement_type == StockMovement.MovementType.SALE_CONSUMPTION:
            raise ValidationError({'movement_type': 'Sale consumption is recorded automatically by sales.'})
        if movement_type == StockMovement.MovementType.RESTOCK and change < 0:
            raise ValidationError({'quantity_change': 'Restock must be positive.'})
        if movement_type == StockMovement.MovementType.WASTE and change > 0:
            raise ValidationError({'quantity_change': 'Waste must be negative.'})

        # Lock the stock row so concurrent movements cannot interleave.
        stock, _ = InventoryStock.objects.select_for_update().get_or_create(
            food_point=food_point, ingredient=ingredient,
            defaults={'quantity_on_hand': 0, 'reorder_level': 0},
        )
        if stock.quantity_on_hand + change < 0:
            raise ValidationError({'quantity_change': (
                f'Only {stock.quantity_on_hand} {ingredient.unit_of_measure} on hand; '
                f'cannot remove {-change}.')})
        stock.quantity_on_hand += change
        stock.save()
        serializer.save(recorded_by=self.request.user)


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


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'conflict'


class InsufficientStock(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Insufficient stock.'
    default_code = 'insufficient_stock'


class SaleCreateView(APIView):
    """
    Staff: record a counter sale in ONE database transaction.

    1. Validate staff assignment, student and that every item belongs to the point.
    2. Insert the sale header and sale items, snapshotting the current price.
    3. Multiply recipe quantities by sold quantities.
    4. Lock inventory rows (SELECT ... FOR UPDATE), verify stock, deduct and log
       SALE_CONSUMPTION movements.
    5. Store the computed total. Any failure rolls back every step.
    Items without a recipe are explicitly not stock-tracked.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    @transaction.atomic
    def post(self, request):
        ser = SaleCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        food_point = FoodPoint.objects.filter(pk=data['food_point_id'], is_active=True).first()
        if food_point is None:
            raise ValidationError({'food_point_id': 'Unknown or inactive food point.'})
        if not _can_operate(request.user, food_point):
            raise PermissionDenied('Not assigned to this food point.')

        student = None
        if data.get('student_user_id'):
            student = User.objects.filter(
                pk=data['student_user_id'], role=User.Role.STUDENT, is_active=True
            ).first()
            if student is None:
                raise ValidationError({'student_user_id': 'Not an active student.'})

        # Validate and merge line items (same item twice -> one line).
        quantities = {}
        for line in data['items']:
            quantities[line['menu_item_id']] = quantities.get(line['menu_item_id'], 0) + line['quantity']
        menu_items = {
            mi.id: mi for mi in MenuItem.objects.filter(pk__in=quantities)
            .prefetch_related('recipes__ingredient')
        }
        for item_id in quantities:
            mi = menu_items.get(item_id)
            if mi is None or mi.food_point_id != food_point.id:
                raise ValidationError({'items': f'Menu item {item_id} is not sold at {food_point.name}.'})
            if not mi.is_available:
                raise ValidationError({'items': f'{mi.item_name} is currently unavailable.'})

        # Total ingredient requirement for the whole sale.
        required = {}
        for item_id, qty in quantities.items():
            for recipe in menu_items[item_id].recipes.all():
                required[recipe.ingredient] = required.get(recipe.ingredient, Decimal('0')) + recipe.quantity_required * qty

        # Lock stock rows in a fixed order (avoids deadlocks) and verify availability.
        stocks = {
            st.ingredient_id: st for st in InventoryStock.objects.select_for_update()
            .filter(food_point=food_point, ingredient__in=required.keys())
            .order_by('ingredient_id')
        }
        shortages = []
        for ingredient, needed in required.items():
            on_hand = stocks[ingredient.id].quantity_on_hand if ingredient.id in stocks else Decimal('0')
            if on_hand < needed:
                shortages.append({
                    'ingredient': ingredient.ingredient_name,
                    'unit': ingredient.unit_of_measure,
                    'required': str(needed), 'on_hand': str(on_hand),
                })
        if shortages:
            raise InsufficientStock({'error': 'Insufficient stock', 'shortages': shortages})

        sale = Sale.objects.create(
            food_point=food_point,
            recorded_by=request.user,
            student_user=student,
            payment_method=data['payment_method'],
            notes=data.get('notes', ''),
        )
        total = Decimal('0')
        for item_id, qty in quantities.items():
            mi = menu_items[item_id]
            SaleItem.objects.create(sale=sale, menu_item=mi, quantity=qty, unit_price=mi.current_price)
            total += mi.current_price * qty

        for ingredient, needed in required.items():
            stock = stocks[ingredient.id]
            stock.quantity_on_hand -= needed
            stock.save()
            StockMovement.objects.create(
                food_point=food_point,
                ingredient=ingredient,
                movement_type=StockMovement.MovementType.SALE_CONSUMPTION,
                quantity_change=-needed,
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
        meal_order = Case(*[When(meal_type=m, then=i) for i, m in
                            enumerate(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'])])
        return qs.order_by('-session_date', meal_order)


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
        ).select_related('session__food_point', 'student_user').order_by(
            '-session__session_date',
            Case(*[When(session__meal_type=m, then=i) for i, m in
                   enumerate(['DINNER', 'SNACKS', 'LUNCH', 'BREAKFAST'])]))


# ── Reports ───────────────────────────────────────

def _query_view(sql, params=()):
    """Run a parameterised query against a report view and return rows as dicts."""
    with connection.cursor() as cur:
        cur.execute(sql, params)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


class ReportSalesByFoodPointView(APIView):
    """Admin: sales summary by food point (SQL view v_sales_by_food_point)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        rows = _query_view('SELECT * FROM v_sales_by_food_point ORDER BY paid_sales DESC')
        return Response([{'id': r['food_point_id'], 'name': r['food_point'],
                          'sale_count': r['sale_count'], 'paid_sales': r['paid_sales']}
                         for r in rows])


class ReportDailyRevenueView(APIView):
    """Admin: paid revenue and order count per day for the last N days
    (GROUP BY DATE(sale_datetime)); days without sales are returned as zero."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        days = min(max(int(request.query_params.get('days', 30)), 1), 365)
        today = timezone.localdate()
        start = today - timedelta(days=days - 1)
        rows = (Sale.objects.filter(payment_status='PAID', sale_datetime__date__gte=start)
                .annotate(day=TruncDate('sale_datetime'))
                .values('day')
                .annotate(revenue=Sum('total_amount'), orders=Count('id')))
        by_day = {r['day']: r for r in rows}
        return Response([
            {'date': d.isoformat(),
             'revenue': by_day.get(d, {}).get('revenue') or 0,
             'orders': by_day.get(d, {}).get('orders') or 0}
            for d in (start + timedelta(days=i) for i in range(days))
        ])


class ReportLowStockView(APIView):
    """Admin/Staff: ingredients at or below reorder level (SQL view v_low_stock)."""
    permission_classes = [permissions.IsAuthenticated, IsStaffRole]

    def get(self, request):
        sql = 'SELECT * FROM v_low_stock'
        params = []
        if request.query_params.get('food_point'):
            sql += ' WHERE food_point_id = %s'
            params.append(request.query_params['food_point'])
        return Response(_query_view(sql + ' ORDER BY food_point, ingredient_name', params))


class ReportStudentHistoryView(APIView):
    """Student sale and mess history by roll number (views v_student_sale_history
    and v_student_mess_history). Students may only look up their own roll number."""

    def get(self, request, roll_no):
        user = request.user
        if user.role == User.Role.STUDENT and user.student_roll_no != roll_no:
            raise PermissionDenied('Students can only view their own history.')
        return Response({
            'sales': _query_view(
                'SELECT * FROM v_student_sale_history WHERE student_roll_no = %s '
                'ORDER BY sale_datetime DESC', [roll_no]),
            'mess': _query_view(
                'SELECT * FROM v_student_mess_history WHERE student_roll_no = %s '
                'ORDER BY session_date DESC', [roll_no]),
        })

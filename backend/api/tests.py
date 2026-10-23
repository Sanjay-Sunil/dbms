from decimal import Decimal

from rest_framework.test import APITestCase

from core.models import FoodPoint, Ingredient, StaffAssignment, User
from inventory.models import InventoryStock, StockMovement
from menu.models import MenuItem, MenuRecipe
from sales.models import Sale


class CounterSaleTransactionTests(APITestCase):
    """The counter sale must be all-or-nothing and keep inventory consistent."""

    def setUp(self):
        self.scoops = FoodPoint.objects.create(name='Scoops')
        self.milma = FoodPoint.objects.create(name='Milma')
        self.staff = User.objects.create_user('staff', password='pw123456', role='STAFF')
        StaffAssignment.objects.create(staff_user=self.staff, food_point=self.scoops)
        self.student = User.objects.create_user(
            'stu', password='pw123456', role='STUDENT', student_roll_no='CS01')

        self.milk = Ingredient.objects.create(ingredient_name='Milk', unit_of_measure='L')
        self.stock = InventoryStock.objects.create(
            food_point=self.scoops, ingredient=self.milk,
            quantity_on_hand=Decimal('1.000'), reorder_level=Decimal('0.200'))

        self.shake = MenuItem.objects.create(
            food_point=self.scoops, item_name='Milkshake', current_price=Decimal('60.00'))
        MenuRecipe.objects.create(menu_item=self.shake, ingredient=self.milk,
                                  quantity_required=Decimal('0.300'))
        self.cone = MenuItem.objects.create(  # no recipe: not stock-tracked
            food_point=self.scoops, item_name='Cone', current_price=Decimal('20.00'))
        self.lassi = MenuItem.objects.create(
            food_point=self.milma, item_name='Lassi', current_price=Decimal('25.00'))

        self.client.force_authenticate(self.staff)

    def sell(self, items, **extra):
        return self.client.post('/api/sales/create/', {
            'food_point_id': self.scoops.id, 'payment_method': 'UPI',
            'items': items, **extra}, format='json')

    def test_sale_snapshots_price_deducts_stock_and_logs_movement(self):
        res = self.sell([{'menu_item_id': self.shake.id, 'quantity': 2},
                         {'menu_item_id': self.cone.id, 'quantity': 1}],
                        student_user_id=self.student.id)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Decimal(res.data['total_amount']), Decimal('140.00'))

        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_on_hand, Decimal('0.400'))
        mv = StockMovement.objects.get(sale_id=res.data['id'])
        self.assertEqual(mv.movement_type, 'SALE_CONSUMPTION')
        self.assertEqual(mv.quantity_change, Decimal('-0.600'))

        # Later price change must not alter the historical sale.
        self.shake.current_price = Decimal('99.00')
        self.shake.save()
        self.assertEqual(Sale.objects.get(pk=res.data['id']).items.get(menu_item=self.shake).unit_price,
                         Decimal('60.00'))

    def test_insufficient_stock_rolls_back_everything(self):
        res = self.sell([{'menu_item_id': self.shake.id, 'quantity': 4}])  # needs 1.2 L
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.data['shortages'][0]['ingredient'], 'Milk')
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 0)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_on_hand, Decimal('1.000'))

    def test_item_from_another_food_point_is_rejected(self):
        res = self.sell([{'menu_item_id': self.lassi.id, 'quantity': 1}])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

    def test_staff_cannot_sell_at_unassigned_point(self):
        res = self.client.post('/api/sales/create/', {
            'food_point_id': self.milma.id, 'payment_method': 'CASH',
            'items': [{'menu_item_id': self.lassi.id, 'quantity': 1}]}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_customer_must_be_a_student(self):
        res = self.sell([{'menu_item_id': self.cone.id, 'quantity': 1}],
                        student_user_id=self.staff.id)
        self.assertEqual(res.status_code, 400)

    def test_sold_menu_item_cannot_be_deleted(self):
        self.sell([{'menu_item_id': self.cone.id, 'quantity': 1}])
        res = self.client.delete(f'/api/menu/manage/{self.cone.id}/')
        self.assertEqual(res.status_code, 409)
        self.assertTrue(MenuItem.objects.filter(pk=self.cone.id).exists())
        self.assertEqual(Sale.objects.count(), 1)

    def test_student_cannot_record_sales(self):
        self.client.force_authenticate(self.student)
        res = self.sell([{'menu_item_id': self.cone.id, 'quantity': 1}])
        self.assertEqual(res.status_code, 403)


class StockMovementTests(APITestCase):
    def setUp(self):
        self.fp = FoodPoint.objects.create(name='Nescafé')
        self.staff = User.objects.create_user('staff', password='pw123456', role='STAFF')
        StaffAssignment.objects.create(staff_user=self.staff, food_point=self.fp)
        self.coffee = Ingredient.objects.create(ingredient_name='Coffee', unit_of_measure='g')
        self.client.force_authenticate(self.staff)

    def move(self, kind, qty):
        return self.client.post('/api/inventory/movement/', {
            'food_point': self.fp.id, 'ingredient': self.coffee.id,
            'movement_type': kind, 'quantity_change': qty}, format='json')

    def test_restock_then_waste(self):
        self.assertEqual(self.move('RESTOCK', '500').status_code, 201)
        self.assertEqual(self.move('WASTE', '-200').status_code, 201)
        stock = InventoryStock.objects.get(food_point=self.fp, ingredient=self.coffee)
        self.assertEqual(stock.quantity_on_hand, Decimal('300.000'))

    def test_cannot_remove_more_than_on_hand(self):
        self.move('RESTOCK', '100')
        res = self.move('WASTE', '-150')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(StockMovement.objects.count(), 1)

    def test_manual_sale_consumption_rejected(self):
        self.assertEqual(self.move('SALE_CONSUMPTION', '-1').status_code, 400)


class RegistrationTests(APITestCase):
    def test_cannot_self_register_as_admin(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'evil', 'password': 'pw123456', 'role': 'ADMIN'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(username='evil').exists())

    def test_student_registration_hashes_password(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'new', 'password': 'pw123456', 'student_roll_no': 'EC99'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        user = User.objects.get(username='new')
        self.assertEqual(user.role, 'STUDENT')
        self.assertNotEqual(user.password, 'pw123456')
        self.assertTrue(user.check_password('pw123456'))


class DatabaseConstraintTests(APITestCase):
    """CHECK constraints from the SQL schema are enforced by the database itself."""

    def test_stock_cannot_go_negative_at_db_level(self):
        from django.db import IntegrityError, transaction
        fp = FoodPoint.objects.create(name='Millets')
        ing = Ingredient.objects.create(ingredient_name='Ragi', unit_of_measure='kg')
        with self.assertRaises(IntegrityError), transaction.atomic():
            InventoryStock.objects.create(food_point=fp, ingredient=ing, quantity_on_hand=-1)

    def test_roll_number_only_for_students(self):
        from django.db import IntegrityError, transaction
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user('s', password='x', role='STUDENT')  # missing roll no
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user('t', password='x', role='STAFF', student_roll_no='X1')


class ReportViewTests(APITestCase):
    def test_reports_read_from_sql_views(self):
        fp = FoodPoint.objects.create(name='Milma')
        admin = User.objects.create_user('adm', password='x', role='ADMIN')
        stu = User.objects.create_user('stu', password='x', role='STUDENT', student_roll_no='CS01')
        Sale.objects.create(food_point=fp, recorded_by=admin, student_user=stu,
                            payment_method='CASH', total_amount=Decimal('50'))
        Sale.objects.create(food_point=fp, recorded_by=admin, payment_method='CASH',
                            payment_status='REFUNDED', total_amount=Decimal('30'))
        ing = Ingredient.objects.create(ingredient_name='Curd', unit_of_measure='L')
        InventoryStock.objects.create(food_point=fp, ingredient=ing,
                                      quantity_on_hand=Decimal('1'), reorder_level=Decimal('2'))

        self.client.force_authenticate(admin)
        row = self.client.get('/api/reports/sales-by-food-point/').data[0]
        self.assertEqual((row['name'], row['sale_count'], Decimal(str(row['paid_sales']))),
                         ('Milma', 2, Decimal('50')))  # refunded sale not counted as revenue
        low = self.client.get('/api/reports/low-stock/').data
        self.assertEqual(low[0]['ingredient_name'], 'Curd')

        self.client.force_authenticate(stu)
        self.assertEqual(len(self.client.get('/api/reports/student/CS01/').data['sales']), 1)
        self.assertEqual(self.client.get('/api/reports/student/CS02/').status_code, 403)

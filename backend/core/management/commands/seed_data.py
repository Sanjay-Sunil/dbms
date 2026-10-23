"""
Populate the database with realistic campus food management data.
Run: python manage.py seed_data
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import User, FoodPoint, Ingredient, StaffAssignment
from menu.models import MenuItem, MenuRecipe
from inventory.models import InventoryStock, StockMovement
from sales.models import Sale, SaleItem
from mess.models import MessMealSession, MessMealRecord


# Realistic opening stock per unit of measure (min, max).
STOCK_RANGE = {
    'g': (2000, 10000), 'ml': (2000, 10000),
    'kg': (10, 60), 'L': (10, 60),
    'piece': (60, 300), 'packet': (20, 80),
}


class Command(BaseCommand):
    help = 'Seed the database with realistic campus food data'

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)  # reproducible demo data
        self.stdout.write('Seeding database...')

        self._create_food_points()
        self._create_ingredients()
        self._create_users()
        self._create_staff_assignments()
        self._create_menu_items()
        self._create_recipes()
        self._create_inventory()
        self._create_sales()
        self._create_mess_sessions()

        self.stdout.write(self.style.SUCCESS('Database seeded successfully!'))

    def _create_food_points(self):
        self.food_points = {}
        points = [
            ('Scoops', 'SHOP', 'Near Main Gate, Ground Floor'),
            ('Nescafé', 'SHOP', 'Central Library Building, Ground Floor'),
            ('Milma', 'SHOP', 'Science Block Corridor'),
            ('Mess Canteen', 'MESS', 'Hostel Block A, Ground Floor'),
            ('Millets', 'SHOP', 'Near Auditorium, First Floor'),
        ]
        for name, ptype, loc in points:
            fp, _ = FoodPoint.objects.get_or_create(
                name=name, defaults={'point_type': ptype, 'location_description': loc}
            )
            self.food_points[name] = fp
        self.stdout.write(f'  Created {len(points)} food points')

    def _create_ingredients(self):
        self.ingredients = {}
        items = [
            ('Milk', 'L'), ('Sugar', 'kg'), ('Coffee Powder', 'g'),
            ('Tea Leaves', 'g'), ('Bread Slices', 'piece'), ('Butter', 'g'),
            ('Eggs', 'piece'), ('Chicken', 'kg'), ('Rice', 'kg'),
            ('Wheat Flour', 'kg'), ('Oil', 'L'), ('Onion', 'kg'),
            ('Tomato', 'kg'), ('Potato', 'kg'), ('Green Chilli', 'g'),
            ('Ginger', 'g'), ('Garlic', 'g'), ('Cumin', 'g'),
            ('Turmeric', 'g'), ('Red Chilli Powder', 'g'), ('Salt', 'kg'),
            ('Coconut', 'piece'), ('Coconut Oil', 'L'), ('Mustard Seeds', 'g'),
            ('Curry Leaves', 'g'), ('Coriander Leaves', 'g'),
            ('Dal (Toor)', 'kg'), ('Dal (Moong)', 'kg'),
            ('Paneer', 'kg'), ('Curd', 'L'), ('Cream', 'L'),
            ('Vanilla Essence', 'ml'), ('Cocoa Powder', 'g'),
            ('Ice Cream Base', 'L'), ('Wafer Cone', 'piece'),
            ('Chocolate Syrup', 'ml'), ('Sprinkles', 'g'),
            ('Nescafé Instant Coffee', 'g'), ('Condensed Milk', 'ml'),
            ('Cardamom', 'g'), ('Sambar Powder', 'g'),
            ('Ragi Flour', 'kg'), ('Millet Flour', 'kg'),
            ('Jaggery', 'kg'), ('Ghee', 'L'), ('Peanuts', 'g'),
            ('Cashew', 'g'), ('Raisins', 'g'),
        ]
        for name, unit in items:
            ing, _ = Ingredient.objects.get_or_create(
                ingredient_name=name, defaults={'unit_of_measure': unit}
            )
            self.ingredients[name] = ing
        self.stdout.write(f'  Created {len(items)} ingredients')

    def _create_users(self):
        # Admin
        admin, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'first_name': 'Rajesh',
                'last_name': 'Kumar',
                'email': 'admin@campus.edu',
                'role': 'ADMIN',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        admin.set_password('admin123')
        admin.save()

        # Staff members
        staff_data = [
            ('anitha_s', 'Anitha', 'Suresh', 'anitha@campus.edu', '9876543210'),
            ('mohan_r', 'Mohan', 'Raj', 'mohan@campus.edu', '9876543211'),
            ('priya_k', 'Priya', 'Krishnan', 'priya@campus.edu', '9876543212'),
            ('suresh_m', 'Suresh', 'Menon', 'suresh@campus.edu', '9876543213'),
            ('lakshmi_n', 'Lakshmi', 'Nair', 'lakshmi@campus.edu', '9876543214'),
        ]
        self.staff_users = []
        for uname, fname, lname, email, phone in staff_data:
            user, _ = User.objects.get_or_create(
                username=uname,
                defaults={
                    'first_name': fname, 'last_name': lname,
                    'email': email, 'role': 'STAFF', 'phone': phone,
                }
            )
            user.set_password('staff123')
            user.save()
            self.staff_users.append(user)

        # Students
        student_data = [
            ('arun_v', 'Arun', 'Vijayan', 'CS22B001', 'arun@campus.edu'),
            ('deepa_m', 'Deepa', 'Mohan', 'CS22B002', 'deepa@campus.edu'),
            ('faisal_k', 'Faisal', 'Khan', 'EC22B001', 'faisal@campus.edu'),
            ('gayathri_r', 'Gayathri', 'Raman', 'ME22B001', 'gayathri@campus.edu'),
            ('hari_p', 'Hari', 'Prasad', 'CS22B003', 'hari@campus.edu'),
            ('isha_s', 'Isha', 'Sharma', 'EC22B002', 'isha@campus.edu'),
            ('jayesh_t', 'Jayesh', 'Thomas', 'ME22B002', 'jayesh@campus.edu'),
            ('kavya_n', 'Kavya', 'Nambiar', 'CS22B004', 'kavya@campus.edu'),
            ('liam_j', 'Liam', 'Joseph', 'EC22B003', 'liam@campus.edu'),
            ('meera_g', 'Meera', 'Gopinath', 'ME22B003', 'meera@campus.edu'),
            ('nikhil_b', 'Nikhil', 'Bhat', 'CS22B005', 'nikhil@campus.edu'),
            ('ojas_d', 'Ojas', 'Deshmukh', 'EC22B004', 'ojas@campus.edu'),
            ('padma_l', 'Padma', 'Lakshmi', 'CS22B006', 'padma@campus.edu'),
            ('rahul_a', 'Rahul', 'Anand', 'ME22B004', 'rahul@campus.edu'),
            ('sneha_c', 'Sneha', 'Chandra', 'CS22B007', 'sneha@campus.edu'),
        ]
        self.student_users = []
        for uname, fname, lname, roll, email in student_data:
            user, _ = User.objects.get_or_create(
                username=uname,
                defaults={
                    'first_name': fname, 'last_name': lname,
                    'email': email, 'role': 'STUDENT',
                    'student_roll_no': roll,
                }
            )
            user.set_password('student123')
            user.save()
            self.student_users.append(user)

        self.stdout.write(f'  Created 1 admin, {len(staff_data)} staff, {len(student_data)} students')

    def _create_staff_assignments(self):
        fp_list = list(self.food_points.values())
        for i, staff in enumerate(self.staff_users):
            StaffAssignment.objects.get_or_create(
                staff_user=staff,
                food_point=fp_list[i % len(fp_list)],
                defaults={'is_active': True}
            )
        self.stdout.write('  Created staff assignments')

    def _create_menu_items(self):
        self.menu_items = {}

        # Scoops — Ice cream & snacks
        scoops_items = [
            ('Vanilla Scoop', 'Ice Cream', 'Classic vanilla bean ice cream', 40),
            ('Chocolate Scoop', 'Ice Cream', 'Rich Belgian chocolate ice cream', 45),
            ('Butterscotch Scoop', 'Ice Cream', 'Crunchy butterscotch ice cream', 45),
            ('Strawberry Scoop', 'Ice Cream', 'Fresh strawberry flavoured ice cream', 40),
            ('Mango Scoop', 'Ice Cream', 'Alphonso mango ice cream (seasonal)', 50),
            ('Sundae Classic', 'Sundae', 'Two scoops with chocolate syrup and sprinkles', 80),
            ('Brownie Sundae', 'Sundae', 'Chocolate brownie with ice cream and hot fudge', 110),
            ('Wafer Cone Single', 'Cone', 'Single scoop in a crispy wafer cone', 50),
            ('Wafer Cone Double', 'Cone', 'Double scoop in a crispy wafer cone', 85),
            ('Milkshake Chocolate', 'Milkshake', 'Thick chocolate milkshake', 70),
            ('Milkshake Vanilla', 'Milkshake', 'Classic vanilla milkshake', 65),
            ('Cold Coffee Float', 'Beverage', 'Cold coffee with a scoop of vanilla', 90),
        ]

        # Nescafé — Coffee & light bites
        nescafe_items = [
            ('Hot Coffee', 'Coffee', 'Classic Nescafé hot coffee', 25),
            ('Cold Coffee', 'Coffee', 'Iced Nescafé with milk and sugar', 40),
            ('Cappuccino', 'Coffee', 'Frothy cappuccino with cocoa dust', 50),
            ('Latte', 'Coffee', 'Smooth coffee latte', 55),
            ('Hot Chocolate', 'Beverage', 'Rich hot chocolate with cream', 50),
            ('Tea', 'Beverage', 'Masala chai — strong and spiced', 15),
            ('Green Tea', 'Beverage', 'Light Japanese green tea', 20),
            ('Veg Sandwich', 'Snack', 'Grilled vegetable sandwich with cheese', 45),
            ('Chicken Sandwich', 'Snack', 'Grilled chicken club sandwich', 65),
            ('Egg Puff', 'Snack', 'Flaky puff pastry with spiced egg filling', 25),
            ('Veg Puff', 'Snack', 'Flaky puff pastry with potato filling', 20),
            ('Brownie', 'Dessert', 'Fudge brownie', 40),
        ]

        # Milma — Dairy & beverages
        milma_items = [
            ('Fresh Milk', 'Dairy', 'Chilled full-cream milk — 200ml', 15),
            ('Flavoured Milk Badam', 'Dairy', 'Badam flavoured milk — 200ml', 25),
            ('Flavoured Milk Rose', 'Dairy', 'Rose flavoured milk — 200ml', 25),
            ('Butter Milk', 'Dairy', 'Spiced buttermilk — 200ml', 10),
            ('Curd Cup', 'Dairy', 'Set curd — 100g cup', 15),
            ('Lassi Sweet', 'Dairy', 'Sweet Punjabi lassi', 30),
            ('Lassi Salt', 'Dairy', 'Salt lassi with cumin', 25),
            ('Milma Ice Cream Bar', 'Frozen', 'Vanilla ice cream bar', 20),
            ('Milma Kulfi', 'Frozen', 'Traditional malai kulfi on stick', 30),
            ('Banana Shake', 'Shake', 'Fresh banana milkshake', 35),
        ]

        # Mess Canteen — Full meals
        mess_items = [
            ('Breakfast Plate', 'Breakfast', 'Idli (4), sambar, chutney', 30),
            ('Dosa Plain', 'Breakfast', 'Crispy plain dosa with sambar and chutney', 25),
            ('Dosa Masala', 'Breakfast', 'Masala dosa with potato filling', 35),
            ('Poori Set', 'Breakfast', 'Poori (3) with potato curry', 30),
            ('Upma', 'Breakfast', 'Rava upma with vegetables', 20),
            ('Lunch Meals', 'Lunch', 'Rice, sambar, rasam, thoran, pickle, papadam', 50),
            ('Chapati Meals', 'Lunch', 'Chapati (3), dal, vegetable curry, rice', 55),
            ('Chicken Meals', 'Lunch', 'Rice, chicken curry, rasam, thoran', 70),
            ('Egg Curry Meals', 'Lunch', 'Rice, egg curry, sambar, thoran', 55),
            ('Dinner Meals', 'Dinner', 'Rice, sambar, aviyal, pickle', 45),
            ('Chapati Dinner', 'Dinner', 'Chapati (3), paneer curry, dal', 55),
            ('Chicken Biriyani', 'Special', 'Hyderabadi chicken biriyani with raita', 90),
            ('Veg Biriyani', 'Special', 'Vegetable dum biriyani with raita', 65),
            ('Parotta Chicken', 'Special', 'Kerala parotta (2) with chicken curry', 75),
            ('Fried Rice Veg', 'Special', 'Vegetable fried rice', 50),
        ]

        # Millets — Healthy options
        millets_items = [
            ('Ragi Dosa', 'Dosa', 'Ragi flour dosa with sambar', 30),
            ('Millet Porridge', 'Porridge', 'Mixed millet porridge with jaggery', 25),
            ('Ragi Puttu', 'Breakfast', 'Steamed ragi puttu with banana', 30),
            ('Millet Upma', 'Breakfast', 'Kodo millet upma with vegetables', 25),
            ('Millet Bowl', 'Bowl', 'Mixed millet bowl with curd and pickle', 40),
            ('Ragi Mudde', 'Main', 'Ragi ball with sambar', 35),
            ('Millet Khichdi', 'Main', 'Barnyard millet khichdi with ghee', 40),
            ('Ragi Roti', 'Bread', 'Ragi flatbread (2) with chutney', 25),
            ('Millet Payasam', 'Dessert', 'Sweet little millet payasam', 30),
            ('Jaggery Tea', 'Beverage', 'Herbal tea sweetened with jaggery', 15),
            ('Millet Cookies', 'Snack', 'Crunchy ragi-oats cookies (3 pcs)', 20),
            ('Health Smoothie', 'Beverage', 'Ragi, banana, jaggery smoothie', 45),
        ]

        all_items = [
            ('Scoops', scoops_items),
            ('Nescafé', nescafe_items),
            ('Milma', milma_items),
            ('Mess Canteen', mess_items),
            ('Millets', millets_items),
        ]

        count = 0
        for fp_name, items in all_items:
            fp = self.food_points[fp_name]
            for item_name, cat, desc, price in items:
                mi, _ = MenuItem.objects.get_or_create(
                    food_point=fp, item_name=item_name,
                    defaults={
                        'category': cat,
                        'description': desc,
                        'current_price': Decimal(str(price)),
                    }
                )
                self.menu_items[f'{fp_name}:{item_name}'] = mi
                count += 1

        self.stdout.write(f'  Created {count} menu items')

    def _create_recipes(self):
        """Link some menu items to ingredients for stock tracking."""
        recipes = {
            'Nescafé:Hot Coffee': [('Nescafé Instant Coffee', 5), ('Milk', 0.15), ('Sugar', 0.01)],
            'Nescafé:Cold Coffee': [('Nescafé Instant Coffee', 5), ('Milk', 0.2), ('Sugar', 0.015), ('Cream', 0.03)],
            'Nescafé:Tea': [('Tea Leaves', 3), ('Milk', 0.1), ('Sugar', 0.01), ('Cardamom', 0.5)],
            'Nescafé:Veg Sandwich': [('Bread Slices', 3), ('Butter', 10), ('Onion', 0.03), ('Tomato', 0.03)],
            'Scoops:Vanilla Scoop': [('Ice Cream Base', 0.1), ('Vanilla Essence', 2), ('Sugar', 0.02)],
            'Scoops:Chocolate Scoop': [('Ice Cream Base', 0.1), ('Cocoa Powder', 10), ('Sugar', 0.02)],
            'Scoops:Wafer Cone Single': [('Ice Cream Base', 0.1), ('Wafer Cone', 1)],
            'Scoops:Milkshake Chocolate': [('Milk', 0.25), ('Ice Cream Base', 0.05), ('Chocolate Syrup', 20), ('Sugar', 0.01)],
            'Milma:Fresh Milk': [('Milk', 0.2)],
            'Milma:Butter Milk': [('Curd', 0.15), ('Salt', 0.002), ('Cumin', 0.5), ('Curry Leaves', 1)],
            'Milma:Lassi Sweet': [('Curd', 0.2), ('Sugar', 0.02), ('Cardamom', 0.5)],
            'Mess Canteen:Breakfast Plate': [('Rice', 0.15), ('Dal (Toor)', 0.03), ('Coconut', 0.25), ('Oil', 0.02)],
            'Mess Canteen:Lunch Meals': [('Rice', 0.25), ('Dal (Toor)', 0.05), ('Coconut Oil', 0.02), ('Onion', 0.05), ('Tomato', 0.03), ('Sambar Powder', 5)],
            'Mess Canteen:Chicken Meals': [('Rice', 0.25), ('Chicken', 0.15), ('Onion', 0.05), ('Tomato', 0.04), ('Oil', 0.03)],
            'Mess Canteen:Chicken Biriyani': [('Rice', 0.3), ('Chicken', 0.2), ('Onion', 0.08), ('Ghee', 0.02), ('Curd', 0.05)],
            'Millets:Ragi Dosa': [('Ragi Flour', 0.1), ('Rice', 0.03), ('Salt', 0.002), ('Oil', 0.01)],
            'Millets:Millet Porridge': [('Millet Flour', 0.08), ('Jaggery', 0.02), ('Milk', 0.15)],
            'Millets:Jaggery Tea': [('Tea Leaves', 3), ('Jaggery', 0.015), ('Milk', 0.08)],
        }

        count = 0
        for key, ingredients in recipes.items():
            mi = self.menu_items.get(key)
            if not mi:
                continue
            for ing_name, qty in ingredients:
                ing = self.ingredients.get(ing_name)
                if not ing:
                    continue
                MenuRecipe.objects.get_or_create(
                    menu_item=mi, ingredient=ing,
                    defaults={'quantity_required': Decimal(str(qty))}
                )
                count += 1

        self.stdout.write(f'  Created {count} recipe entries')

    def _create_inventory(self):
        """Stock each food point with relevant ingredients."""
        count = 0
        for fp in self.food_points.values():
            # Find ingredients used in this food point's recipes
            menu_ids = MenuItem.objects.filter(food_point=fp).values_list('id', flat=True)
            recipe_ings = MenuRecipe.objects.filter(
                menu_item_id__in=menu_ids
            ).values_list('ingredient_id', flat=True).distinct()

            for ing_id in recipe_ings:
                ing = Ingredient.objects.get(pk=ing_id)
                low, high = STOCK_RANGE[ing.unit_of_measure]
                step = Decimal('1') if ing.unit_of_measure in ('piece', 'packet') else Decimal('0.001')
                qty = Decimal(str(random.uniform(low, high))).quantize(step)
                reorder = (qty * Decimal('0.2')).quantize(step)
                if random.random() < 0.15:  # a few items running low, for the low-stock report
                    qty = (reorder * Decimal('0.6')).quantize(step)
                InventoryStock.objects.get_or_create(
                    food_point=fp, ingredient=ing,
                    defaults={'quantity_on_hand': qty, 'reorder_level': reorder}
                )
                count += 1

        self.stdout.write(f'  Created {count} inventory stock entries')

    def _create_sales(self):
        """Generate sample sales over the past 30 days."""
        today = date.today()
        count = 0
        payment_methods = ['CASH', 'UPI', 'CARD']

        for fp in self.food_points.values():
            if fp.point_type == 'MESS':
                continue  # Mess uses meal sessions, not counter sales

            fp_menu = list(MenuItem.objects.filter(food_point=fp, is_available=True))
            if not fp_menu:
                continue

            # Find the staff assigned to this food point
            assignment = StaffAssignment.objects.filter(food_point=fp, is_active=True).first()
            if not assignment:
                continue
            staff = assignment.staff_user

            for day_offset in range(30, 0, -1):
                sale_date = today - timedelta(days=day_offset)
                num_sales = random.randint(3, 8)

                for _ in range(num_sales):
                    student = random.choice(self.student_users) if random.random() > 0.3 else None
                    sale = Sale.objects.create(
                        food_point=fp,
                        recorded_by=staff,
                        student_user=student,
                        payment_method=random.choice(payment_methods),
                        payment_status='PAID',
                        notes='',
                    )
                    # Override the auto-set datetime
                    hour = random.randint(8, 20)
                    minute = random.randint(0, 59)
                    Sale.objects.filter(pk=sale.pk).update(
                        sale_datetime=timezone.make_aware(
                            timezone.datetime(sale_date.year, sale_date.month, sale_date.day, hour, minute)
                        )
                    )

                    total = Decimal('0')
                    num_items = random.randint(1, 3)
                    chosen_items = random.sample(fp_menu, min(num_items, len(fp_menu)))
                    for mi in chosen_items:
                        qty = random.randint(1, 3)
                        SaleItem.objects.create(
                            sale=sale, menu_item=mi,
                            quantity=qty, unit_price=mi.current_price
                        )
                        total += mi.current_price * qty

                    sale.total_amount = total
                    sale.save(update_fields=['total_amount'])  # keep the back-dated sale_datetime
                    count += 1

        self.stdout.write(f'  Created {count} sales with items')

    def _create_mess_sessions(self):
        """Generate mess meal sessions and attendance for the past 14 days."""
        today = date.today()
        mess = self.food_points.get('Mess Canteen')
        if not mess:
            return

        assignment = StaffAssignment.objects.filter(food_point=mess, is_active=True).first()
        if not assignment:
            return
        staff = assignment.staff_user

        meal_types = ['BREAKFAST', 'LUNCH', 'DINNER']
        meal_prices = {'BREAKFAST': 30, 'LUNCH': 50, 'DINNER': 45}

        session_count = 0
        record_count = 0

        for day_offset in range(14, 0, -1):
            session_date = today - timedelta(days=day_offset)

            for meal_type in meal_types:
                session, created = MessMealSession.objects.get_or_create(
                    food_point=mess,
                    session_date=session_date,
                    meal_type=meal_type,
                    defaults={'created_by': staff}
                )
                if not created:
                    continue
                session_count += 1

                # Random attendance for each student
                for student in self.student_users:
                    present = random.random() > 0.15  # 85% attendance
                    att_status = 'SERVED' if present else 'ABSENT'
                    pay_status = 'PAID' if present else 'EXEMPT'
                    amount = Decimal(str(meal_prices[meal_type])) if present else Decimal('0')

                    MessMealRecord.objects.get_or_create(
                        session=session,
                        student_user=student,
                        defaults={
                            'attendance_status': att_status,
                            'amount_due': amount,
                            'payment_status': pay_status,
                            'recorded_by': staff,
                        }
                    )
                    record_count += 1

        self.stdout.write(f'  Created {session_count} mess sessions, {record_count} meal records')

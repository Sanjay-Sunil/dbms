"""
Report views from campus_food_management.sql, adapted to Django's column
names (primary keys are `id`, foreign keys are `<name>_id`).
"""
from django.db import migrations

VIEWS = {
    'v_sales_by_food_point': """
        SELECT fp.id AS food_point_id, fp.name AS food_point,
               COUNT(DISTINCT s.id) AS sale_count,
               COALESCE(SUM(CASE WHEN s.payment_status = 'PAID'
                                 THEN s.total_amount ELSE 0 END), 0) AS paid_sales
        FROM food_point fp
        LEFT JOIN sale s ON s.food_point_id = fp.id
        GROUP BY fp.id, fp.name
    """,
    'v_student_sale_history': """
        SELECT u.id AS user_id, u.student_roll_no,
               u.first_name || ' ' || u.last_name AS full_name,
               s.id AS sale_id, s.sale_datetime, fp.name AS food_point,
               s.payment_method, s.payment_status, s.total_amount
        FROM app_user u
        JOIN sale s ON s.student_user_id = u.id
        JOIN food_point fp ON fp.id = s.food_point_id
        WHERE u.role = 'STUDENT'
    """,
    'v_low_stock': """
        SELECT fp.id AS food_point_id, fp.name AS food_point,
               i.ingredient_name, i.unit_of_measure,
               st.quantity_on_hand, st.reorder_level
        FROM inventory_stock st
        JOIN food_point fp ON fp.id = st.food_point_id
        JOIN ingredient i ON i.id = st.ingredient_id
        WHERE st.quantity_on_hand <= st.reorder_level
    """,
    'v_student_mess_history': """
        SELECT u.student_roll_no,
               u.first_name || ' ' || u.last_name AS full_name,
               ms.session_date, ms.meal_type,
               mr.attendance_status, mr.amount_due, mr.payment_status
        FROM mess_meal_record mr
        JOIN app_user u ON u.id = mr.student_user_id
        JOIN mess_meal_session ms ON ms.id = mr.session_id
    """,
}


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_alter_user_managers_and_more'),
        ('inventory', '0002_stockmovement_idx_movement_point_ing_date_and_more'),
        ('sales', '0002_sale_idx_sale_datetime_sale_idx_sale_point_datetime_and_more'),
        ('mess', '0002_messmealrecord_chk_meal_amount'),
    ]

    operations = [
        migrations.RunSQL(
            sql=f'CREATE VIEW {name} AS {body};',
            reverse_sql=f'DROP VIEW IF EXISTS {name};',
        )
        for name, body in VIEWS.items()
    ]

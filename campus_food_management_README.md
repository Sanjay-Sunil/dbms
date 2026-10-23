# Campus Food Management System

## Stack
- MySQL 8.0+
- Python 3.10+
- `mysql-connector-python` for database connectivity
- Terminal / command-line interface only; no web or graphical frontend

## Food points
Scoops, Nescafé, Milma, Mess Canteen, Millets.

## Main features
- Student, staff, and admin account records
- Staff assignments to food points
- Static menus and prices
- Ingredient inventory, recipes, stock movements, and low-stock report
- Staff-entered counter sales (no online ordering)
- Optional student identification on counter sales
- Mess breakfast/lunch/dinner sessions and student meal records
- Reports: sales by food point, student sale history, low stock

## Setup
1. Install MySQL Server 8.0 or later.
2. Run `campus_food_management.sql` in MySQL Workbench or:
   `mysql -u root -p < campus_food_management.sql`
3. Install the connector:
   `pip install mysql-connector-python`
4. Create a local `.env` file or other secure configuration for database host, database name, username, and password. Do not hardcode credentials or commit them to Git.
5. Build the Python CLI with separate modules for database access, authentication/authorization, menu and inventory maintenance, counter sales, mess records, and reports.

## Important implementation rule: recording a counter sale
Use one database transaction:
1. Validate that the logged-in staff member is assigned to the food point and every menu item belongs to that point.
2. Insert a sale header and its sale items. Snapshot the current menu price into `sale_item.unit_price`.
3. For each sale item, multiply the recipe quantity by the sold quantity.
4. Lock the relevant `inventory_stock` rows (`SELECT ... FOR UPDATE`), verify sufficient stock, subtract the ingredient quantities, and insert corresponding negative `stock_movement` rows with type `SALE_CONSUMPTION`.
5. Calculate the total from sale items and update `sale.total_amount`.
6. Commit only if all steps succeed; otherwise roll back everything.

If an item has no recipe, the application must either require a recipe before sale or explicitly mark it as not stock-tracked. Never silently deduct arbitrary ingredients. For cash sales with an unidentified customer, set `student_user_id` to NULL.

## Security and data integrity
- Store salted password hashes, never plaintext passwords.
- Enforce role checks in the application before allowing changes.
- Use parameterized SQL queries.
- Use transactions for sale recording and stock adjustments.
- Only mark a sale paid when payment is confirmed.
- For a refund, retain the original sale and record the refund/audit action; restore inventory only according to the actual returned/wasted items.
- Restrict database credentials and make regular backups.

## Reports
- `SELECT * FROM v_sales_by_food_point;`
- `SELECT * FROM v_student_sale_history WHERE student_roll_no = ?;`
- `SELECT * FROM v_low_stock;`
- `SELECT * FROM v_student_mess_history WHERE student_roll_no = ?;`

## Important limitation
The schema provides data structures and report views. Business workflows such as automatic stock deduction, staff-to-point authorization, total recalculation, and role-based access are implemented in the Python application inside database transactions (or may be added as stored procedures/triggers after testing).

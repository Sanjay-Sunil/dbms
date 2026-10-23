CREATE DATABASE IF NOT EXISTS campus_food_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE campus_food_management;

-- 1. Campus food points
CREATE TABLE food_point (
    food_point_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    point_type ENUM('SHOP','MESS') NOT NULL DEFAULT 'SHOP',
    location_description VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Accounts for students, staff and administrators
CREATE TABLE app_user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role ENUM('STUDENT','STAFF','ADMIN') NOT NULL,
    student_roll_no VARCHAR(30) UNIQUE,
    email VARCHAR(120) UNIQUE,
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_student_roll_role
      CHECK ((role = 'STUDENT' AND student_roll_no IS NOT NULL)
          OR (role <> 'STUDENT' AND student_roll_no IS NULL))
);

-- 3. Staff-to-food-point assignments
CREATE TABLE staff_assignment (
    staff_assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_user_id INT NOT NULL,
    food_point_id INT NOT NULL,
    assigned_from DATE NOT NULL DEFAULT (CURRENT_DATE),
    assigned_until DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_assignment_user FOREIGN KEY (staff_user_id)
      REFERENCES app_user(user_id),
    CONSTRAINT fk_assignment_point FOREIGN KEY (food_point_id)
      REFERENCES food_point(food_point_id),
    CONSTRAINT chk_assignment_dates
      CHECK (assigned_until IS NULL OR assigned_until >= assigned_from)
);

-- 4. Static menu and prices
CREATE TABLE menu_item (
    menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
    food_point_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(60),
    description VARCHAR(255),
    current_price DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_menu_point FOREIGN KEY (food_point_id)
      REFERENCES food_point(food_point_id),
    CONSTRAINT chk_menu_price CHECK (current_price >= 0),
    CONSTRAINT uq_menu_item_per_point UNIQUE (food_point_id, item_name)
);

-- 5. Ingredient master (e.g. milk, coffee powder, flour)
CREATE TABLE ingredient (
    ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
    ingredient_name VARCHAR(100) NOT NULL UNIQUE,
    unit_of_measure ENUM('g','kg','ml','L','piece','packet') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Stock held at each food point
CREATE TABLE inventory_stock (
    food_point_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity_on_hand DECIMAL(12,3) NOT NULL DEFAULT 0,
    reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (food_point_id, ingredient_id),
    CONSTRAINT fk_stock_point FOREIGN KEY (food_point_id)
      REFERENCES food_point(food_point_id),
    CONSTRAINT fk_stock_ingredient FOREIGN KEY (ingredient_id)
      REFERENCES ingredient(ingredient_id),
    CONSTRAINT chk_stock_qty CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_reorder_qty CHECK (reorder_level >= 0)
);

-- 7. Recipe: ingredient quantities required for one menu item
CREATE TABLE menu_recipe (
    menu_item_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity_required DECIMAL(12,3) NOT NULL,
    PRIMARY KEY (menu_item_id, ingredient_id),
    CONSTRAINT fk_recipe_menu FOREIGN KEY (menu_item_id)
      REFERENCES menu_item(menu_item_id),
    CONSTRAINT fk_recipe_ingredient FOREIGN KEY (ingredient_id)
      REFERENCES ingredient(ingredient_id),
    CONSTRAINT chk_recipe_qty CHECK (quantity_required > 0)
);

-- 8. Counter sale header. Student is optional for anonymous purchases.
CREATE TABLE sale (
    sale_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    food_point_id INT NOT NULL,
    recorded_by INT NOT NULL,
    student_user_id INT NULL,
    sale_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method ENUM('CASH','UPI','CARD','OTHER') NOT NULL,
    payment_status ENUM('PAID','PENDING','REFUNDED') NOT NULL DEFAULT 'PAID',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes VARCHAR(255),
    CONSTRAINT fk_sale_point FOREIGN KEY (food_point_id)
      REFERENCES food_point(food_point_id),
    CONSTRAINT fk_sale_staff FOREIGN KEY (recorded_by)
      REFERENCES app_user(user_id),
    CONSTRAINT fk_sale_student FOREIGN KEY (student_user_id)
      REFERENCES app_user(user_id),
    CONSTRAINT chk_sale_total CHECK (total_amount >= 0)
);

-- 9. Items included in a counter sale; unit_price preserves historical price
CREATE TABLE sale_item (
    sale_item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    menu_item_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_sale_item_sale FOREIGN KEY (sale_id)
      REFERENCES sale(sale_id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_item_menu FOREIGN KEY (menu_item_id)
      REFERENCES menu_item(menu_item_id),
    CONSTRAINT chk_sale_item_qty CHECK (quantity > 0),
    CONSTRAINT chk_sale_item_price CHECK (unit_price >= 0)
);

-- 10. Auditable inventory movements: receipt, sale consumption, adjustment
CREATE TABLE stock_movement (
    movement_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    food_point_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    movement_type ENUM('RESTOCK','SALE_CONSUMPTION','ADJUSTMENT','WASTE') NOT NULL,
    quantity_change DECIMAL(12,3) NOT NULL,
    sale_id BIGINT NULL,
    recorded_by INT NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movement_point FOREIGN KEY (food_point_id)
      REFERENCES food_point(food_point_id),
    CONSTRAINT fk_movement_ingredient FOREIGN KEY (ingredient_id)
      REFERENCES ingredient(ingredient_id),
    CONSTRAINT fk_movement_sale FOREIGN KEY (sale_id)
      REFERENCES sale(sale_id),
    CONSTRAINT fk_movement_user FOREIGN KEY (recorded_by)
      REFERENCES app_user(user_id),
    CONSTRAINT chk_movement_nonzero CHECK (quantity_change <> 0)
);

-- 11. Mess meal sessions (breakfast/lunch/dinner on a date)
CREATE TABLE mess_meal_session (
    session_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    food_point_id INT NOT NULL,
    session_date DATE NOT NULL,
    meal_type ENUM('BREAKFAST','LUNCH','DINNER','SNACKS') NOT NULL,
    notes VARCHAR(255),
    created_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_point FOREIGN KEY (food_point_id)
      REFERENCES food_point(food_point_id),
    CONSTRAINT fk_session_creator FOREIGN KEY (created_by)
      REFERENCES app_user(user_id),
    CONSTRAINT uq_mess_session UNIQUE (food_point_id, session_date, meal_type)
);

-- 12. Student attendance/meal/payment record for a mess session
CREATE TABLE mess_meal_record (
    meal_record_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    student_user_id INT NOT NULL,
    attendance_status ENUM('SERVED','ABSENT','EXEMPT') NOT NULL DEFAULT 'SERVED',
    amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status ENUM('PAID','PENDING','EXEMPT') NOT NULL DEFAULT 'PENDING',
    recorded_by INT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_meal_record_session FOREIGN KEY (session_id)
      REFERENCES mess_meal_session(session_id),
    CONSTRAINT fk_meal_record_student FOREIGN KEY (student_user_id)
      REFERENCES app_user(user_id),
    CONSTRAINT fk_meal_record_staff FOREIGN KEY (recorded_by)
      REFERENCES app_user(user_id),
    CONSTRAINT uq_student_per_session UNIQUE (session_id, student_user_id),
    CONSTRAINT chk_meal_amount CHECK (amount_due >= 0)
);

-- Helpful indexes for common reports and lookups
CREATE INDEX idx_sale_datetime ON sale(sale_datetime);
CREATE INDEX idx_sale_point_datetime ON sale(food_point_id, sale_datetime);
CREATE INDEX idx_sale_student_datetime ON sale(student_user_id, sale_datetime);
CREATE INDEX idx_menu_point_available ON menu_item(food_point_id, is_available);
CREATE INDEX idx_movement_point_ingredient_date
  ON stock_movement(food_point_id, ingredient_id, created_at);

-- Report 1: sales by food point
CREATE VIEW v_sales_by_food_point AS
SELECT fp.food_point_id, fp.name AS food_point,
       COUNT(DISTINCT s.sale_id) AS sale_count,
       COALESCE(SUM(CASE WHEN s.payment_status = 'PAID'
                         THEN s.total_amount ELSE 0 END), 0) AS paid_sales
FROM food_point fp
LEFT JOIN sale s ON s.food_point_id = fp.food_point_id
GROUP BY fp.food_point_id, fp.name;

-- Report 2: student sale history
CREATE VIEW v_student_sale_history AS
SELECT u.user_id, u.student_roll_no, u.full_name,
       s.sale_id, s.sale_datetime, fp.name AS food_point,
       s.payment_method, s.payment_status, s.total_amount
FROM app_user u
JOIN sale s ON s.student_user_id = u.user_id
JOIN food_point fp ON fp.food_point_id = s.food_point_id
WHERE u.role = 'STUDENT';

-- Report 3: low stock
CREATE VIEW v_low_stock AS
SELECT fp.name AS food_point, i.ingredient_name, i.unit_of_measure,
       st.quantity_on_hand, st.reorder_level
FROM inventory_stock st
JOIN food_point fp ON fp.food_point_id = st.food_point_id
JOIN ingredient i ON i.ingredient_id = st.ingredient_id
WHERE st.quantity_on_hand <= st.reorder_level;

-- Additional report: mess meal history per student
CREATE VIEW v_student_mess_history AS
SELECT u.student_roll_no, u.full_name, ms.session_date, ms.meal_type,
       mr.attendance_status, mr.amount_due, mr.payment_status
FROM mess_meal_record mr
JOIN app_user u ON u.user_id = mr.student_user_id
JOIN mess_meal_session ms ON ms.session_id = mr.session_id;

-- Seed the five food points. IDs are generated; query by name, not assumed IDs.
INSERT INTO food_point (name, point_type, location_description) VALUES
('Scoops', 'SHOP', 'Campus food point'),
('Nescafé', 'SHOP', 'Campus food point'),
('Milma', 'SHOP', 'Campus food point'),
('Mess Canteen', 'MESS', 'Campus mess canteen'),
('Millets', 'SHOP', 'Campus food point');

-- Example report queries:
-- SELECT * FROM v_sales_by_food_point ORDER BY paid_sales DESC;
-- SELECT * FROM v_student_sale_history WHERE student_roll_no = 'ROLL-NO-HERE'
--   ORDER BY sale_datetime DESC;
-- SELECT * FROM v_low_stock ORDER BY food_point, ingredient_name;
-- SELECT * FROM v_student_mess_history WHERE student_roll_no = 'ROLL-NO-HERE'
--   ORDER BY session_date DESC;

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  foodPointAPI, menuAPI, inventoryAPI, salesAPI, messAPI, authAPI, ingredientAPI
} from '../../api/client';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import {
  Store, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, AlertTriangle,
  Receipt, Package, Users, Calendar, ArrowRight, RefreshCw, Search, Coffee
} from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'sales' | 'inventory' | 'mess'
  const [loading, setLoading] = useState(true);

  // Active Food Point Context
  const [foodPoints, setFoodPoints] = useState([]);
  const [activeOutlet, setActiveOutlet] = useState(null);

  // POS / Cart state
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerType, setCustomerType] = useState('WALKIN'); // 'WALKIN' | 'STUDENT'
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [saleNotes, setSaleNotes] = useState('');
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  // Sales log
  const [salesList, setSalesList] = useState([]);

  // Inventory
  const [inventoryList, setInventoryList] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    ingredient_id: '',
    movement_type: 'RESTOCK',
    quantity_change: '',
    reason: '',
  });

  // Mess sessions (if mess canteen)
  const [messSessions, setMessSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    session_date: new Date().toISOString().split('T')[0],
    meal_type: 'LUNCH',
    notes: '',
  });

  // Students list for lookup
  const [studentsList, setStudentsList] = useState([]);

  // Load food points and resolve active outlet
  useEffect(() => {
    loadOutletsAndInitialData();
  }, []);

  // When active outlet changes, reload menu, inventory, and sales
  useEffect(() => {
    if (activeOutlet) {
      loadOutletSpecificData(activeOutlet.id);
    }
  }, [activeOutlet]);

  const loadOutletsAndInitialData = async () => {
    setLoading(true);
    try {
      const [fpRes, usersRes, ingRes] = await Promise.all([
        foodPointAPI.list(),
        authAPI.listUsers('STUDENT').catch(() => ({ data: [] })),
        ingredientAPI.list().catch(() => ({ data: [] })),
      ]);

      const fps = Array.isArray(fpRes.data) ? fpRes.data : fpRes.data?.results || [];
      const students = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.results || [];
      const ingredients = Array.isArray(ingRes.data) ? ingRes.data : ingRes.data?.results || [];

      setFoodPoints(fps);
      setStudentsList(students);
      setAllIngredients(ingredients);

      // Determine default active outlet:
      // If staff has assigned food point, pick their assigned one. Otherwise pick the first one.
      const assigned = user?.assigned_food_points?.[0];
      const matchedFp = assigned
        ? fps.find((f) => f.id === assigned.id) || fps[0]
        : fps[0];
      setActiveOutlet(matchedFp);
    } catch (err) {
      console.error('Failed to load initial staff data', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOutletSpecificData = async (fpId) => {
    try {
      const [menuRes, invRes, salesRes] = await Promise.all([
        menuAPI.list({ food_point: fpId }),
        inventoryAPI.list({ food_point: fpId }),
        salesAPI.list({ food_point: fpId }),
      ]);

      const menu = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.results || [];
      const inv = Array.isArray(invRes.data) ? invRes.data : invRes.data?.results || [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.results || [];

      setMenuItems(menu);
      setInventoryList(inv);
      setSalesList(sales);
      setCart([]); // Reset cart when switching outlet

      // If active outlet is a MESS, load mess sessions
      if (activeOutlet?.point_type === 'MESS') {
        loadMessSessions(fpId);
      }
    } catch (err) {
      console.error('Failed to load outlet data', err);
    }
  };

  const loadMessSessions = async (fpId) => {
    try {
      const res = await messAPI.sessions({ food_point: fpId });
      const sessions = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setMessSessions(sessions);
      if (sessions.length > 0) {
        loadSessionDetail(sessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load mess sessions', err);
    }
  };

  const loadSessionDetail = async (sessionId) => {
    setSelectedSessionId(sessionId);
    try {
      const res = await messAPI.sessionDetail(sessionId);
      setSelectedSessionDetail(res.data);
    } catch (err) {
      console.error('Failed to load session details', err);
    }
  };

  // Cart Management
  const addToCart = (item) => {
    const existing = cart.find((c) => c.item.id === item.id);
    if (existing) {
      setCart(cart.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, delta) => {
    setCart(
      cart
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((c) => c.item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + parseFloat(c.item.current_price) * c.quantity, 0);

  // Submit Sale
  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    setPosSubmitting(true);
    try {
      const payload = {
        food_point_id: activeOutlet.id,
        student_user_id: customerType === 'STUDENT' && selectedStudentId ? parseInt(selectedStudentId) : null,
        payment_method: paymentMethod,
        notes: saleNotes,
        items: cart.map((c) => ({
          menu_item_id: c.item.id,
          quantity: c.quantity,
        })),
      };

      const res = await salesAPI.create(payload);
      setLastSaleReceipt(res.data);
      setCart([]);
      setSaleNotes('');
      setSelectedStudentId('');

      // Refresh sales log and inventory stock levels
      loadOutletSpecificData(activeOutlet.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record sale.');
    } finally {
      setPosSubmitting(false);
    }
  };

  // Record Stock Movement
  const handleSaveStockMovement = async (e) => {
    e.preventDefault();
    if (!stockFormData.ingredient_id || !stockFormData.quantity_change) return;

    try {
      const qty = parseFloat(stockFormData.quantity_change);
      // If waste, ensure negative
      const adjustedQty = stockFormData.movement_type === 'WASTE' ? -Math.abs(qty) : qty;

      await inventoryAPI.addMovement({
        food_point: activeOutlet.id,
        ingredient: parseInt(stockFormData.ingredient_id),
        movement_type: stockFormData.movement_type,
        quantity_change: adjustedQty,
        reason: stockFormData.reason,
      });

      setIsStockModalOpen(false);
      setStockFormData({
        ingredient_id: '',
        movement_type: 'RESTOCK',
        quantity_change: '',
        reason: '',
      });
      // Refresh inventory
      loadOutletSpecificData(activeOutlet.id);
    } catch (err) {
      alert('Failed to record stock movement.');
    }
  };

  // Create Mess Session
  const handleCreateMessSession = async (e) => {
    e.preventDefault();
    try {
      await messAPI.createSession({
        food_point: activeOutlet.id,
        session_date: newSessionData.session_date,
        meal_type: newSessionData.meal_type,
        notes: newSessionData.notes,
      });
      setIsNewSessionModalOpen(false);
      loadMessSessions(activeOutlet.id);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create meal session.');
    }
  };

  // Mark student served in active mess session
  const handleMarkStudentServed = async (studentId) => {
    if (!selectedSessionId) return;
    try {
      const mealPrices = { BREAKFAST: 30, LUNCH: 50, DINNER: 45, SNACKS: 20 };
      const session = messSessions.find((s) => s.id === selectedSessionId);
      const price = session ? mealPrices[session.meal_type] || 40 : 40;

      await messAPI.createRecord({
        session: selectedSessionId,
        student_user: studentId,
        attendance_status: 'SERVED',
        amount_due: price,
        payment_status: 'PAID',
      });
      loadSessionDetail(selectedSessionId);
    } catch (err) {
      alert(err.response?.data?.non_field_errors?.[0] || 'Already recorded or error occurred.');
    }
  };

  const lowStockCount = inventoryList.filter((i) => i.is_low).length;
  const filteredStudents = studentsList.filter((s) =>
    studentSearch === '' ||
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.student_roll_no?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Outlet Context Bar */}
        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="roleStaff">STAFF PORTAL</Badge>
                {activeOutlet?.point_type === 'MESS' ? (
                  <Badge variant="info">MESS CANTEEN</Badge>
                ) : (
                  <Badge variant="outline">COUNTER POS</Badge>
                )}
                {lowStockCount > 0 && (
                  <Badge variant="warning">
                    <AlertTriangle className="w-3 h-3" />
                    {lowStockCount} Low Stock
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>{activeOutlet?.name || 'Outlet Management'}</span>
              </h1>
              <p className="text-xs text-zinc-400">
                {activeOutlet?.location_description || 'Campus Food Outlet'} · Logged in as{' '}
                <span className="text-zinc-200 font-medium">{user?.full_name || user?.username}</span>
              </p>
            </div>

            {/* Outlet Switcher (Useful if user is assigned to another food point or admin testing) */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-zinc-500 uppercase">Outlet:</span>
              <select
                value={activeOutlet?.id || ''}
                onChange={(e) => {
                  const fp = foodPoints.find((f) => f.id === parseInt(e.target.value));
                  if (fp) setActiveOutlet(fp);
                }}
                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
              >
                {foodPoints.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.name} ({fp.point_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-5 border-t border-zinc-800/80 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'pos'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Counter POS</span>
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'sales'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Sales Log ({salesList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'inventory'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Inventory Stock ({inventoryList.length})</span>
            </button>

            {activeOutlet?.point_type === 'MESS' && (
              <button
                onClick={() => setActiveTab('mess')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                  activeTab === 'mess'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Mess Attendance Ledger</span>
              </button>
            )}

            <button
              onClick={() => activeOutlet && loadOutletSpecificData(activeOutlet.id)}
              title="Refresh Data"
              className="ml-auto p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TAB 1: COUNTER POS (POINT OF SALE) ────────────────────────── */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 cols: Menu Items Grid */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Outlet Menu Catalog ({menuItems.length})
                </h2>
                <span className="text-xs text-zinc-400">Click item to add to bill</span>
              </div>

              {menuItems.length === 0 ? (
                <div className="p-8 text-center bg-[#121212] border border-zinc-800 rounded-xl text-zinc-400">
                  No menu items found for this outlet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      disabled={!item.is_available}
                      className="bg-[#121212] border border-zinc-800 hover:border-zinc-600 disabled:opacity-40 rounded-xl p-3 text-left transition flex flex-col justify-between h-28 cursor-pointer group hover:bg-zinc-900/40"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">
                          {item.category}
                        </span>
                        <div className="text-xs font-semibold text-white group-hover:text-zinc-100 line-clamp-2">
                          {item.item_name}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-sm font-bold text-white font-mono">
                          ₹{parseFloat(item.current_price).toFixed(0)}
                        </span>
                        <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-zinc-300 group-hover:bg-white group-hover:text-black transition">
                          <Plus className="w-3 h-3" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right 5 cols: Active Order Bill / Checkout */}
            <div className="lg:col-span-5 bg-[#121212] border border-zinc-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-zinc-300" />
                  <span className="text-sm font-semibold text-white">Current Order Bill</span>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear Bill
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Bill is empty. Select items from the menu catalog on the left to ring up sale.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {cart.map((line) => (
                    <div
                      key={line.item.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-medium text-white truncate">{line.item.item_name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          ₹{parseFloat(line.item.current_price).toFixed(0)} each
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-zinc-700 rounded bg-zinc-800">
                          <button
                            onClick={() => updateQuantity(line.item.id, -1)}
                            className="p-1 hover:text-white text-zinc-400 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-mono font-medium text-white text-xs">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(line.item.id, 1)}
                            className="p-1 hover:text-white text-zinc-400 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="w-14 text-right font-mono font-semibold text-white">
                          ₹{(parseFloat(line.item.current_price) * line.quantity).toFixed(0)}
                        </span>

                        <button
                          onClick={() => removeFromCart(line.item.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Link: Walk-in vs Student */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  Customer Type
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => { setCustomerType('WALKIN'); setSelectedStudentId(''); }}
                    className={`py-1.5 px-3 rounded-lg border text-center transition cursor-pointer ${
                      customerType === 'WALKIN'
                        ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    Walk-in / Cash Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerType('STUDENT')}
                    className={`py-1.5 px-3 rounded-lg border text-center transition cursor-pointer ${
                      customerType === 'STUDENT'
                        ? 'bg-zinc-800 text-white border-zinc-600 font-semibold'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    Campus Student
                  </button>
                </div>

                {customerType === 'STUDENT' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search roll no (e.g. CS22B001)..."
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none"
                    >
                      <option value="">-- Select Student Account --</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.student_roll_no} · {s.full_name || s.username}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {['UPI', 'CASH', 'CARD'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 px-2 rounded-lg border text-center font-mono font-medium transition cursor-pointer ${
                        paymentMethod === m
                          ? 'bg-zinc-200 text-black border-zinc-200 font-bold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total & Submit Button */}
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 font-mono uppercase">Total Bill Amount</span>
                  <div className="text-2xl font-bold text-white font-mono">
                    ₹{cartTotal.toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={handleProcessSale}
                  disabled={cart.length === 0 || posSubmitting}
                  className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 disabled:opacity-40 text-black font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  {posSubmitting ? (
                    <span>Recording Sale...</span>
                  ) : (
                    <>
                      <span>Complete Sale & Bill</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Last Sale Confirmation Notice */}
              {lastSaleReceipt && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Sale #{lastSaleReceipt.id} Recorded Successfully!</span>
                  </div>
                  <div className="text-[11px] text-emerald-400/80">
                    Billed ₹{parseFloat(lastSaleReceipt.total_amount).toFixed(2)} via {lastSaleReceipt.payment_method}.
                    Inventory stock automatically adjusted via recipe deduction.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: SALES LOG ─────────────────────────────────────────── */}
        {activeTab === 'sales' && (
          <div className="bg-[#121212] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Sales Register · {activeOutlet?.name}</h2>
                <p className="text-xs text-zinc-400">{salesList.length} total orders recorded</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/70 text-[11px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Sale ID</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Total (₹)</th>
                    <th className="px-4 py-3">Cashier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {salesList.map((sale) => (
                    <tr key={sale.id} className="hover:bg-zinc-900/40 transition">
                      <td className="px-4 py-3 font-mono font-medium text-white">
                        #{sale.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        {new Date(sale.sale_datetime).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {sale.student_name ? (
                          <span className="text-white font-medium">{sale.student_name}</span>
                        ) : (
                          <span className="text-zinc-500 italic">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-zinc-300">
                        {sale.items?.map((it) => `${it.quantity}x ${it.item_name}`).join(', ') || 'Itemized'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" size="xs">
                          {sale.payment_method}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-white">
                        ₹{parseFloat(sale.total_amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {sale.recorded_by_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: INVENTORY STOCK & MOVEMENTS ───────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Ingredient Inventory · {activeOutlet?.name}
                </h2>
                <p className="text-xs text-zinc-400">
                  Track raw material stock on hand and trigger restocks
                </p>
              </div>

              <button
                onClick={() => setIsStockModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Stock Movement</span>
              </button>
            </div>

            <div className="bg-[#121212] border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/70 text-[11px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Ingredient</th>
                      <th className="px-4 py-3">On Hand</th>
                      <th className="px-4 py-3">Reorder Threshold</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {inventoryList.map((stock) => (
                      <tr key={stock.id} className="hover:bg-zinc-900/40 transition">
                        <td className="px-4 py-3 font-medium text-white">
                          {stock.ingredient_name}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          {parseFloat(stock.quantity_on_hand).toFixed(2)} {stock.unit}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {parseFloat(stock.reorder_level).toFixed(2)} {stock.unit}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={stock.is_low ? 'warning' : 'success'} size="xs">
                            {stock.is_low ? 'Low Stock' : 'Adequate'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {new Date(stock.last_updated).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: MESS SESSIONS (MESS ONLY) ─────────────────────────── */}
        {activeTab === 'mess' && activeOutlet?.point_type === 'MESS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 4 cols: Session Picker */}
            <div className="lg:col-span-4 bg-[#121212] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Mess Meal Sessions</h3>
                <button
                  onClick={() => setIsNewSessionModalOpen(true)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSessionDetail(s.id)}
                    className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${
                      selectedSessionId === s.id
                        ? 'bg-zinc-800/90 border-zinc-500 text-white'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white uppercase font-mono">
                        {s.meal_type}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {s.session_date}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right 8 cols: Attendance Ledger */}
            <div className="lg:col-span-8 bg-[#121212] border border-zinc-800 rounded-2xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Attendance Ledger · {selectedSessionDetail?.meal_type} ({selectedSessionDetail?.session_date})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedSessionDetail?.records?.length || 0} students recorded
                  </p>
                </div>
              </div>

              {/* Quick Serve Student Action */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <span className="text-xs font-mono uppercase text-zinc-400">Quick Mark Meal Served</span>
                <div className="flex gap-2">
                  <select
                    id="quickStudentSelect"
                    className="flex-1 bg-[#121212] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {studentsList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.student_roll_no} — {st.full_name || st.username}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const sel = document.getElementById('quickStudentSelect');
                      if (sel?.value) handleMarkStudentServed(sel.value);
                    }}
                    className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-lg transition cursor-pointer"
                  >
                    Mark Served
                  </button>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/60 font-mono text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2.5">Roll No</th>
                      <th className="px-3 py-2.5">Student Name</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Charge</th>
                      <th className="px-3 py-2.5">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {selectedSessionDetail?.records?.map((rec) => (
                      <tr key={rec.id}>
                        <td className="px-3 py-2.5 font-mono text-zinc-300">
                          {rec.student_roll || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-white font-medium">
                          {rec.student_name}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={rec.attendance_status === 'SERVED' ? 'success' : 'default'} size="xs">
                            {rec.attendance_status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-white">
                          ₹{parseFloat(rec.amount_due || 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" size="xs">
                            {rec.payment_status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stock Movement Modal */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title="Record Stock Movement"
        subtitle={`Update ingredient levels at ${activeOutlet?.name}`}
      >
        <form onSubmit={handleSaveStockMovement} className="space-y-4 text-xs">
          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Ingredient</label>
            <select
              required
              value={stockFormData.ingredient_id}
              onChange={(e) => setStockFormData({ ...stockFormData, ingredient_id: e.target.value })}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            >
              <option value="">-- Choose Ingredient --</option>
              {allIngredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.ingredient_name} ({ing.unit_of_measure})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono uppercase text-zinc-400 mb-1">Movement Type</label>
              <select
                value={stockFormData.movement_type}
                onChange={(e) => setStockFormData({ ...stockFormData, movement_type: e.target.value })}
                className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
              >
                <option value="RESTOCK">Restock (+)</option>
                <option value="ADJUSTMENT">Adjustment (+/-)</option>
                <option value="WASTE">Waste / Spoilage (-)</option>
              </select>
            </div>

            <div>
              <label className="block font-mono uppercase text-zinc-400 mb-1">Quantity</label>
              <input
                type="number"
                step="0.001"
                required
                value={stockFormData.quantity_change}
                onChange={(e) => setStockFormData({ ...stockFormData, quantity_change: e.target.value })}
                placeholder="e.g. 10.0"
                className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Reason / Note</label>
            <input
              type="text"
              value={stockFormData.reason}
              onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })}
              placeholder="e.g. Weekly vendor delivery, batch expiry..."
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition cursor-pointer mt-2"
          >
            Save Stock Movement
          </button>
        </form>
      </Modal>

      {/* New Mess Session Modal */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="Start Mess Meal Session"
        subtitle="Hostel canteen daily meal attendance session"
      >
        <form onSubmit={handleCreateMessSession} className="space-y-4 text-xs">
          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Session Date</label>
            <input
              type="date"
              required
              value={newSessionData.session_date}
              onChange={(e) => setNewSessionData({ ...newSessionData, session_date: e.target.value })}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Meal Type</label>
            <select
              value={newSessionData.meal_type}
              onChange={(e) => setNewSessionData({ ...newSessionData, meal_type: e.target.value })}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            >
              <option value="BREAKFAST">Breakfast (₹30)</option>
              <option value="LUNCH">Lunch (₹50)</option>
              <option value="DINNER">Dinner (₹45)</option>
              <option value="SNACKS">Evening Snacks (₹20)</option>
            </select>
          </div>

          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Notes</label>
            <input
              type="text"
              value={newSessionData.notes}
              onChange={(e) => setNewSessionData({ ...newSessionData, notes: e.target.value })}
              placeholder="e.g. Special Feast menu"
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition cursor-pointer mt-2"
          >
            Create Meal Session
          </button>
        </form>
      </Modal>
    </div>
  );
}

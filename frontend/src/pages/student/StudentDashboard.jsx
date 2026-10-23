import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { menuAPI, foodPointAPI, salesAPI, messAPI } from '../../api/client';
import Badge from '../../components/Badge';
import {
  Search, Utensils, Receipt, CalendarCheck, Clock, CheckCircle2,
  AlertCircle, IndianRupee, Store, Filter, RefreshCw, ShoppingBag, UserCheck
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'purchases' | 'mess'
  const [loading, setLoading] = useState(true);

  // Data states
  const [foodPoints, setFoodPoints] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [messHistory, setMessHistory] = useState([]);

  // Filter states
  const [selectedOutlet, setSelectedOutlet] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item modal / detail
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [fpRes, menuRes, salesRes, messRes] = await Promise.all([
        foodPointAPI.list(),
        menuAPI.list(),
        salesAPI.list(),
        messAPI.myHistory(),
      ]);

      const fps = Array.isArray(fpRes.data) ? fpRes.data : fpRes.data?.results || [];
      const menu = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.results || [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.results || [];
      const mess = Array.isArray(messRes.data) ? messRes.data : messRes.data?.results || [];

      setFoodPoints(fps);
      setMenuItems(menu);
      setPurchases(sales);
      setMessHistory(mess);
    } catch (err) {
      console.error('Failed to load student data', err);
    } finally {
      setLoading(false);
    }
  };

  // Derive categories from current menu items
  const categories = ['ALL', ...new Set(menuItems.map((m) => m.category).filter(Boolean))];

  // Filtered menu items
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesOutlet = selectedOutlet === 'ALL' || String(item.food_point) === String(selectedOutlet);
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesOutlet && matchesCategory && matchesSearch;
  });

  // Calculate student stats
  const totalSpent = purchases.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
  const messAttendedCount = messHistory.filter((m) => m.attendance_status === 'SERVED').length;
  const messAttendanceRate = messHistory.length > 0
    ? Math.round((messAttendedCount / messHistory.length) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome & Stats Banner */}
        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="roleStudent">STUDENT PORTAL</Badge>
                {user?.student_roll_no && (
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    {user.student_roll_no}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Hello, {user?.first_name || user?.username}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Explore menus across campus outlets and review your meal & order history.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Spent</div>
                <div className="text-base sm:text-xl font-bold text-white font-mono">
                  ₹{totalSpent.toFixed(0)}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{purchases.length} Orders</div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Mess Meals</div>
                <div className="text-base sm:text-xl font-bold text-white font-mono">
                  {messAttendedCount}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Attended</div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Attendance</div>
                <div className="text-base sm:text-xl font-bold text-emerald-400 font-mono">
                  {messAttendanceRate}%
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Rate</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-8 pt-6 border-t border-zinc-800/80 overflow-x-auto">
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'menu'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Campus Menus</span>
            </button>

            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'purchases'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>My Purchases ({purchases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mess')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'mess'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Mess History ({messHistory.length})</span>
            </button>

            <button
              onClick={fetchInitialData}
              title="Refresh Data"
              className="ml-auto p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── TAB 1: CAMPUS MENUS ────────────────────────────────────────── */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            {/* Outlets Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                onClick={() => setSelectedOutlet('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer shrink-0 ${
                  selectedOutlet === 'ALL'
                    ? 'bg-zinc-200 text-black border-zinc-200 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                All Outlets ({menuItems.length})
              </button>
              {foodPoints.map((fp) => (
                <button
                  key={fp.id}
                  onClick={() => setSelectedOutlet(fp.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer shrink-0 ${
                    String(selectedOutlet) === String(fp.id)
                      ? 'bg-zinc-200 text-black border-zinc-200 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{fp.name}</span>
                </button>
              ))}
            </div>

            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item by name or ingredients..."
                  className="w-full pl-9 pr-4 py-2 bg-[#121212] border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5">
                {categories.slice(0, 8).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-zinc-800 text-white border border-zinc-600'
                        : 'bg-zinc-900/60 text-zinc-400 border border-zinc-800/80 hover:text-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Cards Grid */}
            {filteredMenuItems.length === 0 ? (
              <div className="p-12 text-center bg-[#121212] border border-zinc-800 rounded-2xl text-zinc-400 space-y-2">
                <Utensils className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-sm">No items found matching your filter criteria.</p>
                <button
                  onClick={() => { setSelectedOutlet('ALL'); setSelectedCategory('ALL'); setSearchQuery(''); }}
                  className="text-xs text-white underline hover:text-zinc-300 cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-[#121212] border border-zinc-800/90 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {item.food_point_name}
                        </span>
                        <Badge variant="outline" size="xs">
                          {item.category}
                        </Badge>
                      </div>

                      <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-zinc-100">
                        {item.item_name}
                      </h3>

                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.description || 'Prepared fresh at outlet counter.'}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-zinc-400 font-mono">₹</span>
                        <span className="text-xl font-bold text-white font-mono">
                          {parseFloat(item.current_price).toFixed(0)}
                        </span>
                      </div>

                      <Badge variant={item.is_available ? 'success' : 'danger'} size="xs">
                        {item.is_available ? 'Available' : 'Sold Out'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: MY PURCHASES ────────────────────────────────────────── */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Counter Purchase Ledger</h2>
              <span className="text-xs text-zinc-400 font-mono">
                {purchases.length} Total Transactions
              </span>
            </div>

            {purchases.length === 0 ? (
              <div className="p-12 text-center bg-[#121212] border border-zinc-800 rounded-2xl text-zinc-400 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-sm">No recorded counter purchases yet.</p>
                <p className="text-xs text-zinc-400">
                  When you buy items at any campus outlet, staff will tag your roll number to record your purchases here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-[#121212] border border-zinc-800 rounded-xl p-4 sm:p-5 hover:border-zinc-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/70">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {sale.food_point_name}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              #{sale.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {new Date(sale.sale_datetime).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:text-right">
                        <div>
                          <div className="text-base font-bold text-white font-mono">
                            ₹{parseFloat(sale.total_amount).toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" size="xs">
                              {sale.payment_method}
                            </Badge>
                            <Badge variant="success" size="xs">
                              {sale.payment_status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Items Breakdown */}
                    {sale.items && sale.items.length > 0 && (
                      <div className="mt-3 pt-1">
                        <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                          Order Details
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          {sale.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/60 text-zinc-300"
                            >
                              <span>
                                <span className="font-semibold text-white">{item.quantity}x</span> {item.item_name}
                              </span>
                              <span className="font-mono text-zinc-400">₹{parseFloat(item.line_total).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: MESS ATTENDANCE ────────────────────────────────────── */}
        {activeTab === 'mess' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Mess Canteen Attendance</h2>
                <p className="text-xs text-zinc-400">Daily hostel meal logs and payment clearances</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-emerald-400">
                  {messAttendedCount} Meals Served
                </span>
              </div>
            </div>

            {messHistory.length === 0 ? (
              <div className="p-12 text-center bg-[#121212] border border-zinc-800 rounded-2xl text-zinc-400 space-y-2">
                <CalendarCheck className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-sm">No mess meal records logged yet.</p>
              </div>
            ) : (
              <div className="bg-[#121212] border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-900/70 text-[11px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-3">Session Date</th>
                        <th className="px-4 py-3">Meal</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Charge</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3">Outlet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {messHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-zinc-900/40 transition">
                          <td className="px-4 py-3 font-mono text-zinc-200">
                            {rec.session_date || rec.recorded_at?.split('T')[0] || 'Recent'}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">
                            {rec.meal_type || 'Daily Meal'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={rec.attendance_status === 'SERVED' ? 'success' : 'default'}
                              size="xs"
                            >
                              {rec.attendance_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-white">
                            ₹{parseFloat(rec.amount_due || 0).toFixed(0)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={rec.payment_status === 'PAID' ? 'outline' : 'warning'}
                              size="xs"
                            >
                              {rec.payment_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            Mess Canteen
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

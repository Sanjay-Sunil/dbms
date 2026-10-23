import { useState, useEffect } from 'react';
import {
  reportsAPI, foodPointAPI, menuAPI, salesAPI, authAPI, ingredientAPI, errorMessage
} from '../../api/client';
import { useToast } from '../../components/Toast';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import RevenueTrend from '../../components/RevenueTrend';
import {
  Shield, BarChart3, AlertTriangle, UtensilsCrossed, Users, Receipt,
  Plus, Edit2, Trash2, Check, RefreshCw, Search, ArrowUpRight, Store
} from 'lucide-react';

export default function AdminDashboard() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'lowstock' | 'sales' | 'menu' | 'users'
  const [loading, setLoading] = useState(true);

  // Data states
  const [salesByFoodPoint, setSalesByFoodPoint] = useState([]);
  const [lowStockReports, setLowStockReports] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [menuList, setMenuList] = useState([]);
  const [foodPoints, setFoodPoints] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Menu CRUD states
  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuFormData, setMenuFormData] = useState({
    food_point: '',
    item_name: '',
    category: '',
    description: '',
    current_price: '',
    is_available: true,
  });

  // User list filter
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');

  // Menu list filter
  const [menuFpFilter, setMenuFpFilter] = useState('ALL');
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [salesFpRes, lowRes, salesRes, menuRes, fpRes, usersRes, dailyRes] = await Promise.all([
        reportsAPI.salesByFoodPoint().catch(() => ({ data: [] })),
        reportsAPI.lowStock().catch(() => ({ data: [] })),
        salesAPI.list({ page_size: 100 }).catch(() => ({ data: [] })),
        menuAPI.list().catch(() => ({ data: [] })),
        foodPointAPI.list().catch(() => ({ data: [] })),
        authAPI.listUsers().catch(() => ({ data: [] })),
        reportsAPI.dailyRevenue(30).catch(() => ({ data: [] })),
      ]);

      const fpSales = Array.isArray(salesFpRes.data) ? salesFpRes.data : salesFpRes.data?.results || [];
      const lowStock = Array.isArray(lowRes.data) ? lowRes.data : lowRes.data?.results || [];
      const sales = Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.results || [];
      setSalesTotal(salesRes.data?.count ?? sales.length);
      const menu = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.results || [];
      const fps = Array.isArray(fpRes.data) ? fpRes.data : fpRes.data?.results || [];
      const users = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.results || [];

      setDailyRevenue(Array.isArray(dailyRes.data) ? dailyRes.data : []);
      setSalesByFoodPoint(fpSales);
      setLowStockReports(lowStock);
      setAllSales(sales);
      setMenuList(menu);
      setFoodPoints(fps);
      setUsersList(users);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  // Aggregated Stats
  const totalRevenue = salesByFoodPoint.reduce((sum, s) => sum + parseFloat(s.paid_sales || 0), 0);
  const totalOrders = salesByFoodPoint.reduce((sum, s) => sum + (s.sale_count || 0), 0);
  const maxRevenueOutlet = salesByFoodPoint.length > 0
    ? Math.max(...salesByFoodPoint.map((s) => parseFloat(s.paid_sales || 0)))
    : 1;

  // Menu Item CRUD Actions
  const handleOpenCreateMenuModal = () => {
    setEditingItem(null);
    setMenuFormData({
      food_point: foodPoints[0]?.id || '',
      item_name: '',
      category: 'Snack',
      description: '',
      current_price: '',
      is_available: true,
    });
    setIsMenuItemModalOpen(true);
  };

  const handleOpenEditMenuModal = (item) => {
    setEditingItem(item);
    setMenuFormData({
      food_point: item.food_point,
      item_name: item.item_name,
      category: item.category,
      description: item.description || '',
      current_price: item.current_price,
      is_available: item.is_available,
    });
    setIsMenuItemModalOpen(true);
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await menuAPI.update(editingItem.id, menuFormData);
      } else {
        await menuAPI.create(menuFormData);
      }
      setIsMenuItemModalOpen(false);
      toast.success(editingItem ? 'Menu item updated.' : 'Menu item created.');
      // Refresh menu
      const res = await menuAPI.list();
      setMenuList(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save menu item.'));
    }
  };

  const handleToggleItemAvailability = async (item) => {
    try {
      await menuAPI.update(item.id, { is_available: !item.is_available });
      setMenuList(menuList.map((m) => m.id === item.id ? { ...m, is_available: !m.is_available } : m));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update availability.'));
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!(await toast.confirm('Delete this menu item? This cannot be undone.', { confirmLabel: 'Delete', danger: true }))) return;
    try {
      await menuAPI.delete(itemId);
      setMenuList(menuList.filter((m) => m.id !== itemId));
      toast.success('Menu item deleted.');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete menu item. Items with sales history cannot be deleted — mark them unavailable instead.'));
    }
  };

  // Filtered menu
  const filteredMenu = menuList.filter((m) => {
    const matchFp = menuFpFilter === 'ALL' || String(m.food_point) === String(menuFpFilter);
    const matchSearch = menuSearch === '' || m.item_name.toLowerCase().includes(menuSearch.toLowerCase());
    return matchFp && matchSearch;
  });

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const matchSearch =
      userSearch === '' ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.student_roll_no?.toLowerCase().includes(userSearch.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Executive Header Banner */}
        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="roleAdmin">SYSTEM ADMINISTRATOR</Badge>
                <span className="text-xs font-mono text-zinc-400">Campus Food Network</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Executive Control Panel
              </h1>
              <p className="text-xs text-zinc-400">
                Cross-campus revenue analytics, inventory alerts, menu master, and user privileges.
              </p>
            </div>

            <button
              onClick={fetchAdminData}
              title="Refresh Data"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition cursor-pointer self-start md:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync System Data</span>
            </button>
          </div>

          {/* Key KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-800/80">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Total Campus Revenue
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Across all 5 campus outlets</div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Total Orders Processed
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {totalOrders}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Completed counter sales</div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Active Campus Outlets
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {foodPoints.length}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Shops & Mess Hall</div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Low Stock Alerts
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {lowStockReports.length}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Below reorder threshold</div>
            </div>
          </div>

          {/* Admin Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-5 border-t border-zinc-800/80 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Revenue Reports</span>
            </button>

            <button
              onClick={() => setActiveTab('lowstock')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'lowstock'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Alerts ({lowStockReports.length})</span>
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
              <span>All Sales Stream ({salesTotal})</span>
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'menu'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu Master ({menuList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                activeTab === 'users'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Directory ({usersList.length})</span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: REVENUE & OUTLET REPORTS ───────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {dailyRevenue.length > 0 && (
              <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6">
                <RevenueTrend data={dailyRevenue} />
              </div>
            )}
            <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-1">
                Sales & Revenue Distribution by Outlet
              </h2>
              <p className="text-xs text-zinc-400 mb-6">
                Served from the SQL view v_sales_by_food_point
              </p>

              <div className="space-y-5">
                {salesByFoodPoint.map((fp) => {
                  const rev = parseFloat(fp.paid_sales || 0);
                  const pct = maxRevenueOutlet > 0 ? (rev / maxRevenueOutlet) * 100 : 0;
                  const shareOfTotal = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : 0;

                  return (
                    <div key={fp.id} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-zinc-400" />
                          <span className="font-semibold text-white text-sm">{fp.name}</span>
                          <span className="text-[11px] text-zinc-500 font-mono">
                            ({fp.sale_count || 0} orders)
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-zinc-400 text-[11px] font-mono">
                            {shareOfTotal}% share
                          </span>
                          <span className="text-sm font-bold text-white font-mono">
                            ₹{rev.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      {/* Minimalist Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-zinc-200 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: LOW STOCK ALERTS ──────────────────────────────────── */}
        {activeTab === 'lowstock' && (
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-white">Campus-Wide Inventory Stock Alerts</h2>
              <p className="text-xs text-zinc-400">
                Ingredients currently below safety reorder threshold requiring procurement
              </p>
            </div>

            {lowStockReports.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs">
                All ingredients across all food points are adequately stocked.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/60 font-mono text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Food Point</th>
                      <th className="px-4 py-3">Ingredient</th>
                      <th className="px-4 py-3">On Hand</th>
                      <th className="px-4 py-3">Reorder Threshold</th>
                      <th className="px-4 py-3">Deficit / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {lowStockReports.map((row, idx) => {
                      const onHand = parseFloat(row.quantity_on_hand);
                      const reorder = parseFloat(row.reorder_level);
                      const deficit = (reorder - onHand).toFixed(2);

                      return (
                        <tr key={idx} className="hover:bg-zinc-900/40 transition">
                          <td className="px-4 py-3 font-semibold text-white">
                            {row.food_point}
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-200">
                            {row.ingredient_name}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-amber-400">
                            {onHand.toFixed(2)} {row.unit_of_measure}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-400">
                            {reorder.toFixed(2)} {row.unit_of_measure}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="warning" size="xs">
                              Restock needed (~{deficit} {row.unit_of_measure})
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ALL SALES STREAM ──────────────────────────────────── */}
        {activeTab === 'sales' && (
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Campus Counter Sales Stream</h2>
                <p className="text-xs text-zinc-400">{salesTotal} total recorded transactions · showing latest {allSales.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/60 font-mono text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Outlet</th>
                    <th className="px-4 py-3">Date / Time</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items Sold</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {allSales.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-900/40 transition">
                      <td className="px-4 py-3 font-mono text-white">#{s.id}</td>
                      <td className="px-4 py-3 font-medium text-white">{s.food_point_name}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        {new Date(s.sale_datetime).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {s.student_name ? (
                          <span className="text-white font-medium">{s.student_name}</span>
                        ) : (
                          <span className="text-zinc-500 italic">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-zinc-300">
                        {s.items?.map((it) => `${it.quantity}x ${it.item_name}`).join(', ') || 'Itemized'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" size="xs">
                          {s.payment_method}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        ₹{parseFloat(s.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: MENU MASTER CRUD ──────────────────────────────────── */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Menu Master Management</h2>
                <p className="text-xs text-zinc-400">
                  Add, update prices, or toggle availability across campus outlets
                </p>
              </div>

              <button
                onClick={handleOpenCreateMenuModal}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Menu Item</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search item name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#121212] border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500"
                />
              </div>

              <select
                value={menuFpFilter}
                onChange={(e) => setMenuFpFilter(e.target.value)}
                className="bg-[#121212] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value="ALL">All Outlets ({menuList.length})</option>
                {foodPoints.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/60 font-mono text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Outlet</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredMenu.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/40 transition">
                        <td className="px-4 py-3 font-medium text-white">{item.food_point_name}</td>
                        <td className="px-4 py-3 font-semibold text-white">{item.item_name}</td>
                        <td className="px-4 py-3 text-zinc-400">{item.category}</td>
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          ₹{parseFloat(item.current_price).toFixed(0)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleItemAvailability(item)}
                            className="cursor-pointer"
                          >
                            <Badge variant={item.is_available ? 'success' : 'danger'} size="xs">
                              {item.is_available ? 'In Stock' : 'Sold Out'}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditMenuModal(item)}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: USER DIRECTORY ────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Campus User Directory</h2>
                <p className="text-xs text-zinc-400">
                  {usersList.length} authenticated users registered in the system
                </p>
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {['ALL', 'STUDENT', 'STAFF', 'ADMIN'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setUserRoleFilter(role)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                      userRoleFilter === role
                        ? 'bg-white text-black font-semibold'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user by name, username, roll number..."
                className="w-full pl-9 pr-3 py-2 bg-[#121212] border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500"
              />
            </div>

            <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/60 font-mono text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Full Name / Username</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Student Roll No</th>
                      <th className="px-4 py-3">Outlet Assignment</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-900/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{u.full_name || u.username}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">@{u.username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              u.role === 'ADMIN'
                                ? 'roleAdmin'
                                : u.role === 'STAFF'
                                ? 'roleStaff'
                                : 'roleStudent'
                            }
                            size="xs"
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-300">
                          {u.student_roll_no || '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {u.assigned_food_points && u.assigned_food_points.length > 0 ? (
                            <span className="font-medium text-white">
                              {u.assigned_food_points.map((a) => a.name).join(', ')}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.is_active ? 'success' : 'danger'} size="xs">
                            {u.is_active ? 'Active' : 'Disabled'}
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

      {/* Menu Item Create/Edit Modal */}
      <Modal
        isOpen={isMenuItemModalOpen}
        onClose={() => setIsMenuItemModalOpen(false)}
        title={editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
        subtitle="Catalog updates reflect immediately across student browsing"
      >
        <form onSubmit={handleSaveMenuItem} className="space-y-4 text-xs">
          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Campus Food Point</label>
            <select
              required
              value={menuFormData.food_point}
              onChange={(e) => setMenuFormData({ ...menuFormData, food_point: e.target.value })}
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            >
              {foodPoints.map((fp) => (
                <option key={fp.id} value={fp.id}>
                  {fp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Item Name</label>
            <input
              type="text"
              required
              value={menuFormData.item_name}
              onChange={(e) => setMenuFormData({ ...menuFormData, item_name: e.target.value })}
              placeholder="e.g. Masala Dosa, Cold Coffee"
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono uppercase text-zinc-400 mb-1">Category</label>
              <input
                type="text"
                required
                value={menuFormData.category}
                onChange={(e) => setMenuFormData({ ...menuFormData, category: e.target.value })}
                placeholder="e.g. Breakfast, Snack, Coffee"
                className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block font-mono uppercase text-zinc-400 mb-1">Price (₹)</label>
              <input
                type="number"
                step="0.50"
                required
                value={menuFormData.current_price}
                onChange={(e) => setMenuFormData({ ...menuFormData, current_price: e.target.value })}
                placeholder="e.g. 45"
                className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono uppercase text-zinc-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={menuFormData.description}
              onChange={(e) => setMenuFormData({ ...menuFormData, description: e.target.value })}
              placeholder="Short description for student catalog..."
              className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_avail"
              checked={menuFormData.is_available}
              onChange={(e) => setMenuFormData({ ...menuFormData, is_available: e.target.checked })}
              className="rounded bg-zinc-900 border-zinc-700"
            />
            <label htmlFor="is_avail" className="text-zinc-300 cursor-pointer">
              Currently Available for Ordering
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition cursor-pointer mt-2"
          >
            {editingItem ? 'Save Changes' : 'Create Menu Item'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

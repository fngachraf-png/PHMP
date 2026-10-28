import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './contexts/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Inventory from './pages/Inventory'
import Prescriptions from './pages/Prescriptions'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Purchases from './pages/Purchases'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Platform from './pages/Platform'
import Legal from './pages/Legal'
import Shop from './pages/Shop'
import LiveOrders from './pages/LiveOrders'
import About from './pages/About'
import Guide from './pages/Guide'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

const ProtectedRoute = ({ children, permission }) => {
  const { currentUser, hasPermission } = useApp()
  if (!currentUser) return <Navigate to="/login" replace />
  // مالك المنصة يصل إلى كل شيء
  if (currentUser.role === 'super_admin') return <Layout>{children}</Layout>
  // التحقق من الصلاحية المطلوبة للصفحة
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />
  return <Layout>{children}</Layout>
}

const PublicRoute = ({ children }) => {
  const { currentUser } = useApp()
  if (currentUser) {
    // السوبر أدمين يوجه مباشرة إلى لوحة المنصة
    if (currentUser.role === 'super_admin') return <Navigate to="/platform" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* واجهة الزبون لشراء الدواء — متاحة للعموم بدون تسجيل موظفين */}
      <Route path="/shop" element={<Shop />} />
      <Route path="/shop/:pharmacyId" element={<Shop />} />

      {/* الصفحات العامة: من نحن / دليل الاستخدام / الشروط / الخصوصية */}
      <Route path="/about" element={<About />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/platform" element={<ProtectedRoute permission="platform.manage"><Platform /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute permission="dashboard.view"><Dashboard /></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute permission="pos.use"><POS /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute permission="orders.view"><LiveOrders /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute permission="inventory.view"><Inventory /></ProtectedRoute>} />
      <Route path="/prescriptions" element={<ProtectedRoute permission="prescriptions.view"><Prescriptions /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute permission="customers.view"><Customers /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute permission="suppliers.view"><Suppliers /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute permission="purchases.view"><Purchases /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute permission="reports.view"><Reports /></ProtectedRoute>} />
      <Route path="/legal" element={<ProtectedRoute permission="legal.view"><Legal /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute permission="settings.view"><Settings /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/shop" replace />} />
      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ToastProvider } from './components/ToastProvider';
import { DashboardPage } from './pages/DashboardPage';
import { RecordsPage } from './pages/RecordsPage';
import { ProductInfoPage } from './pages/ProductInfoPage';
import { UploadWizardPage } from './pages/UploadWizardPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { DictionaryImportPage } from './pages/DictionaryImportPage';
import { EquipmentHistoryPage } from './pages/EquipmentHistoryPage';
import { MergeAuditPage } from './pages/MergeAuditPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/products" element={<ProductInfoPage />} />
            <Route path="/upload" element={<UploadWizardPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/dictionary/import" element={<DictionaryImportPage />} />
            <Route path="/equipment" element={<EquipmentHistoryPage />} />
            <Route path="/audit" element={<MergeAuditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;

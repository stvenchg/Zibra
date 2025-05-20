import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConnectionProvider } from './context/ConnectionContext';
import { ToastProvider } from './components/ui/toast';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { TransferPage } from './pages/TransferPage';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <HelmetProvider>
        <ToastProvider>
          <ConnectionProvider>
            <div className="min-h-screen bg-background text-foreground flex flex-col">
              <Header />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/transfer/:deviceId" element={<TransferPage />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </ConnectionProvider>
        </ToastProvider>
      </HelmetProvider>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConnectionProvider } from './context/ConnectionContext';
import { HomePage } from './pages/HomePage';
import { TransferPage } from './pages/TransferPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <ConnectionProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/transfer/:deviceId" element={<TransferPage />} />
          </Routes>
        </div>
      </ConnectionProvider>
    </BrowserRouter>
  );
}

export default App;

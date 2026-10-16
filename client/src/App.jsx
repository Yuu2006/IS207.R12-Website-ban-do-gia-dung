import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { OrderServiceProvider } from './context/OrderServiceContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
import './styles/app-shell.css';

// Lắp ghép router và phiên; trang cùng nghiệp vụ nằm ở module tương ứng.
export default function App() {
  return <BrowserRouter><AuthProvider><OrderServiceProvider><AppRoutes /></OrderServiceProvider></AuthProvider></BrowserRouter>;
}

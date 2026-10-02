import LoginForm from './pages/login-form/LoginForm.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrderWorkspace from './pages/customer/OrderWorkspace.jsx';

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginForm />} /><Route path="/*" element={<OrderWorkspace />} /></Routes></BrowserRouter>;
}

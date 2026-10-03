import { Routes, Route } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";

import HomePage from "../pages/public/HomePage";
import ProductListPage from "../pages/public/ProductListPage";
import ProductDetailPage from "../pages/public/ProductDetailPage";

export default function AppRoutes() {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/products" element={<ProductListPage />} />

        <Route path="/products/:id" element={<ProductDetailPage />} />
      </Routes>

      <Footer />
    </>
  );
}

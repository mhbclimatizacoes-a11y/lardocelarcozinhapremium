import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { Loading } from "./components/Cards";
import Cart from "./pages/Cart";
import { Catalog, CombosPage } from "./pages/Catalog";
import Checkout from "./pages/Checkout";
import ComboPage from "./pages/ComboPage";
import Home from "./pages/Home";
import OrderPage from "./pages/Order";
import ProductPage from "./pages/Product";
import { NotFound, PolicyPage } from "./pages/Static";

const Admin = lazy(() => import("./admin/AdminApp"));

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Suspense fallback={<Loading />}><Admin /></Suspense>} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="produtos" element={<Catalog />} />
        <Route path="categoria/:slug" element={<Catalog />} />
        <Route path="produto/:slug" element={<ProductPage />} />
        <Route path="combos" element={<CombosPage />} />
        <Route path="combo/:slug" element={<ComboPage />} />
        <Route path="carrinho" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="pedido/:token" element={<OrderPage />} />
        <Route path="politicas/:slug" element={<PolicyPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

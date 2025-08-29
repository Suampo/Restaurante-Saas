import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import AppLayout from "./ui/AppLayout.jsx";
import Home from "./pages/Home.jsx";
import RestaurantPublic from "./pages/RestaurantPublic.jsx";
import Contact from "./pages/Contact.jsx";
import NotFound from "./pages/NotFound.jsx";

import RegisterRestaurant from "./pages/auth/RegisterRestaurant.jsx";
import PlanSelection from "./pages/auth/PlanSelection.jsx";
import Checkout from "./pages/auth/Checkout.jsx";

// legales
import Terms from "./pages/legal/Terms.jsx";
import Privacy from "./pages/legal/Privacy.jsx";
import Returns from "./pages/legal/Returns.jsx";
import Consent from "./pages/legal/Consent.jsx";
import ClaimsBook from "./pages/legal/ClaimsBook.jsx";
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/r/:code", element: <RestaurantPublic /> },
      { path: "/contacto", element: <Contact /> },

      // flujo de alta
      { path: "/registro", element: <RegisterRestaurant /> },
      { path: "/registro/planes", element: <PlanSelection /> },
      { path: "/registro/pago", element: <Checkout /> },

      // legales
      { path: "/legal/terminos", element: <Terms /> },
      { path: "/legal/privacidad", element: <Privacy /> },
      { path: "/legal/devoluciones", element: <Returns /> },
      { path: "/legal/consentimiento", element: <Consent /> },
{ path: "/libro-de-reclamaciones", element: <ClaimsBook /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

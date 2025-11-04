// pages/EditarMenu.jsx
import React, { useEffect, useState } from "react";
import API from "../services/axiosInstance";


import MenuItemEdit from "../components/MenuItemEdit";
const EditarMenu = () => {
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
  const fetchMenu = async () => {
    try {
      const res = await axios.get("/menu/items"); // 👈 ya no necesitas poner token
      setMenuItems(res.data);
    } catch (err) {
      console.error("Error cargando ítems del menú", err);
    }
  };

  fetchMenu();
}, []);

  return (
    <div>
      <h2>Editar Imágenes del Menú</h2>
      {menuItems.map((item) => (
        <MenuItemEdit key={item.id} menuItem={item} />
      ))}
    </div>
  );
};

export default EditarMenu;
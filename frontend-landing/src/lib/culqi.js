// src/lib/culqi.js
export function openCulqiCheckout({ amount, email, orderId, onToken, onOrder }) {
  if (!window.CulqiCheckout) {
    alert("No cargó Culqi");
    return;
  }
  const publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY;

  const settings = { title: "Mikhunapp", currency: "PEN", amount, order: orderId || undefined };
  const client = { email };
  const paymentMethods = { tarjeta: true, yape: !!orderId }; // Yape solo con Orders
  const options = { lang: "es", installments: false, modal: true, paymentMethods };

  const instance = new window.CulqiCheckout(publicKey, { settings, client, options });

  window.Culqi = window.Culqi || {};
  window.Culqi.culqi = () => {
    if (window.Culqi.token) {
      const tokenId = window.Culqi.token.id;
      window.Culqi.close();
      onToken?.(tokenId);
    } else if (window.Culqi.order) {
      const order = window.Culqi.order;
      window.Culqi.close();
      onOrder?.(order);
    } else if (window.Culqi.error) {
      console.log("Culqi error:", window.Culqi.error);
    }
  };

  instance.open();
}

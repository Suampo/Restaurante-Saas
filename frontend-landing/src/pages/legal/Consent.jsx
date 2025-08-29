export default function Consent() {
  return (
    <main className="py-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold">Tratamiento necesario de datos (Consentimiento)</h1>

        <section className="mt-6 space-y-4 text-sm leading-6 text-neutral-700">
          <p>
            Al marcar “Acepto” o continuar usando el menú/panel, autorizo a <strong>Gerimi Angelo Oroncoy Cordova [Mikhunappfood]</strong> a
            tratar mis datos personales para:
          </p>
          <ul className="list-disc pl-5">
            <li>Operar el servicio (cuenta, registro de pedidos, atención y seguridad).</li>
            <li>Comunicaciones operativas y de seguridad.</li>
            <li>Marketing (ofertas y novedades) —opcional y revocable.</li>
          </ul>
          <p className="mt-4">
            Puedo ejercer mis derechos ARCO en mikhunappfood@gmail.com. Mi información puede compartirse con Culqi u otra pasarela de pago
            y proveedores tecnológicos para fines operativos. Se rige por la Ley N.° 29733 y su Reglamento.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function Privacy() {
  return (
    <main className="py-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold">Política de Privacidad de Mikhunapp</h1>

        <section className="mt-6 space-y-4 text-sm leading-6 text-neutral-700">
          <p>
            <strong>Última actualización:</strong> 19/08/2025
          </p>
          <p>
            <strong>Titular / Responsable (para datos B2B):</strong> Gerimi Angelo Oroncoy Cordova, RUC 10778055070, domicilio en Lima - Ate - Ceres 3ra etapa Los duraznos. 
            <br />
            <strong>Correo de privacidad:</strong> mikhunappfood@gmail.com
          </p>

          <h2 className="mt-6 text-base font-semibold">1. Alcance y roles</h2>
          <p>
            Esta Política aplica al sitio <strong>mikhunapp.com</strong>, al Panel Admin y a los subdominios del tipo <strong>[restaurante].mikhunapp.com</strong>.
            <br />
            <strong>Mikhunapp como Responsable:</strong> datos de representantes de restaurantes (B2B), prospectos, soporte y visitantes del sitio.
            <br />
            <strong>Mikhunapp como Encargado del Restaurante:</strong> datos operativos del Tenant y de comensales (pedidos, mesa, menú, etc.). En ese caso, el <strong>Restaurante</strong> es el Responsable y define finalidades y plazos.
          </p>

          <h2 className="mt-6 text-base font-semibold">2. Datos que tratamos</h2>
          <p>
            <strong>Como Responsable (B2B):</strong> identificación y contacto, cuenta del Panel (usuario, roles; <em>hash</em> de contraseña), tickets de soporte, IP y datos técnicos mínimos (dispositivo, fecha/hora).
            <br />
            <strong>Como Encargado del Restaurante:</strong> menús, productos, precios, mesas, usuarios internos; pedidos (items, notas, importes, estado, timestamps); datos opcionales de comensales (nombre/alias, contacto si lo ingresan, preferencias/alergias si el Restaurante habilita esos campos).
          </p>

          <h2 className="mt-6 text-base font-semibold">3. Finalidades y bases legales</h2>
          <ul className="list-disc pl-5">
            <li><strong>Prestación del servicio / ejecución contractual</strong> (B2B).</li>
            <li><strong>Seguridad y prevención de fraude/abuso</strong> (interés legítimo proporcional).</li>
            <li><strong>Cumplimiento legal</strong> (contable/tributario, atención de autoridades).</li>
            <li><strong>Comunicaciones operativas</strong> y, si lo autorizas, <strong>marketing</strong> (consentimiento revocable).</li>
            <li><strong>Como Encargado:</strong> ejecutar instrucciones del Restaurante para la operación del Tenant.</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold">4. Pagos</h2>
          <p>
            Los pagos se procesan a través de <strong>Culqi u otro proovedor de pasarela de pagos</strong>. Mikhunapp <strong>no</strong> recolecta ni almacena datos sensibles de tarjeta (PAN/CVV). 
          </p>

          <h2 className="mt-6 text-base font-semibold">5. Encargados y transferencias</h2>
          <p>
            Usamos proveedores (cloud, correo/soporte, analítica y Culqi,etc) como <strong>(sub)encargados</strong>. 
            Si hubiera transferencias internacionales, se realizarán con <strong>garantías adecuadas</strong>.
          </p>

          <h2 className="mt-6 text-base font-semibold">6. Conservación</h2>
          <ul className="list-disc pl-5">
            <li><strong>Datos B2B (Responsable):</strong> durante la relación y por plazos de prescripción legal.</li>
            <li><strong>Datos del Tenant (Encargado):</strong> según instrucciones del Restaurante y lo previsto en los Términos.</li>
          </ul>
          <p className="italic">
            Transparencia: actualmente <strong>no garantizamos</strong> copias de seguridad automáticas ni retención de registros de actividad por plazos específicos. 
            El Restaurante puede solicitar una <strong>exportación</strong> de datos (ver sección 8).
          </p>

          <h2 className="mt-6 text-base font-semibold">7. Medidas de seguridad</h2>
          <p>
            Aplicamos medidas razonables: <strong>cifrado TLS en tránsito</strong>, controles de acceso y <strong>segregación lógica por Tenant</strong> en una base de datos multi-tenant compartida.
            <br />
            Si detectamos un <strong>incidente de seguridad</strong> que afecte datos personales, notificaremos sin dilación indebida a los contactos registrados y, cuando corresponda, al Restaurante para que cumpla sus obligaciones.
          </p>

          <h2 className="mt-6 text-base font-semibold">8. Exportación y eliminación de datos del Tenant</h2>
          <p>
            El <strong>Restaurante</strong> puede <strong>solicitar</strong> una exportación razonable de los datos operativos (CSV/JSON) escribiendo a mikhunappfood@gmail.com o +51 950809208. 
            Mikhunapp la entregará hasta en <strong>10 días hábiles</strong> tras verificar titularidad. Tras la terminación del servicio, podremos conservar datos por hasta <strong>30 días</strong> 
            solo para completar la exportación solicitada y luego proceder a la <strong>eliminación</strong> en un máximo de <strong>90 días</strong>, salvo conservación legal.
          </p>

          <h2 className="mt-6 text-base font-semibold">9. Derechos ARCO (Perú)</h2>
          <p>
            Puedes ejercer <strong>acceso, rectificación, cancelación y oposición</strong> conforme a la Ley N.º 29733.
            <br />
            <strong>Comensales o datos dentro de un Tenant:</strong> dirige tu solicitud al <strong>Restaurante (Responsable)</strong>; Mikhunapp lo asistirá como Encargado.
            <br />
            <strong>Representantes B2B / visitantes del sitio:</strong> escribe a <strong>mikhunappfood@gmail.com</strong>.
          </p>
          <p>
            Plazos de referencia: hasta <strong>20 días hábiles</strong> para acceso y hasta <strong>10 días hábiles</strong> para rectificación/cancelación/oposición, según normativa. 
            Podremos solicitar información para verificar identidad o representación.
          </p>

          <h2 className="mt-6 text-base font-semibold">10. Menores de edad</h2>
          <p>
            El Panel Admin es para mayores de 18 años. Si detectamos datos de menores sin autorización válida, los eliminaremos razonablemente pronto.
          </p>

          <h2 className="mt-6 text-base font-semibold">11. Cookies</h2>
          <p>
            Usamos cookies <strong>esenciales</strong> para autenticación/funcionamiento y, eventualmente, <strong>analíticas</strong> (opt-in). 
            Puedes gestionarlas desde tu navegador. Cuando habilitemos el banner, podrás elegir o retirar consentimiento para categorías no esenciales.
          </p>

          <h2 className="mt-6 text-base font-semibold">12. Bancos de datos y autoridad</h2>
          <p>
            Los bancos de datos personales de Mikhunapp (p. ej., “Usuarios Web”, “Clientes y Proveedores”) se inscribirán ante el registro correspondiente cuando sea exigible. 
            También puedes acudir a la Autoridad Nacional de Protección de Datos Personales (MINJUSDH).
          </p>

          <h2 className="mt-6 text-base font-semibold">13. Cambios a esta Política</h2>
          <p>
            Publicaremos la versión vigente en <strong>mikhunapp.com</strong> con su fecha de actualización. 
            Si los cambios son materiales, lo comunicaremos por los medios registrados.
          </p>

          <h2 className="mt-6 text-base font-semibold">14. Contacto</h2>
          <p>
            <strong>Privacidad:</strong> <a className="underline" href="mailto:[EMAIL PRIVACIDAD]">mikhunappfood@gmail.com</a>
            <br />
            <strong>Soporte:</strong> <a className="underline" href="mailto:[EMAIL SOPORTE]">mikhunappfood@gmail.com</a> · +51 950809208
            <br />
            <strong>Términos:</strong> <a className="underline" href="/legal/terminos">/legal/terminos</a>
          </p>
        </section>
      </div>
    </main>
  );
}

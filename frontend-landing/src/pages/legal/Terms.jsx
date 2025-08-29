export default function Terms() {
  return (
    <main className="py-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold">Términos y Condiciones de Uso de Mikhunapp</h1>

        <section className="mt-6 space-y-4 text-sm leading-6 text-neutral-700">
          <p>
            <strong>Última actualización:</strong> 19/08/2025
          </p>
          <p>
            <strong>Titular del servicio:</strong> Gerimi Angelo Oroncoy Cordova, RUC 10778055070 , domicilio en Lima - Ate - Vitarte Los duraznos Ceres  (“MikhunApp”, “nosotros”).
          </p>

          <h2 className="mt-6 text-base font-semibold">1. Objeto y alcance</h2>
          <p>
            Mikhunapp es una plataforma SaaS para restaurantes que permite administrar menú digital, pedidos por QR, pagos en línea y comanda automática. Estos Términos regulan el uso del sitio <strong>mikhunapp.com</strong> y sus subdominios (p. ej., <strong>[restaurante].mikhunapp.com</strong>), así como del Panel Admin por parte de restaurantes (clientes B2B) y comensales (usuarios finales B2C).
          </p>

          <h2 className="mt-6 text-base font-semibold">2. Definiciones</h2>
          <p>
            <strong>Tenant:</strong> espacio lógico independiente asignado a cada restaurante bajo un subdominio del tipo [restaurante].mikhunapp.com.
            <br />
            <strong>Restaurante:</strong> persona natural o jurídica titular del Tenant.
            <br />
            <strong>Comensal:</strong> usuario que consulta el menú, realiza pedidos y/o efectúa pagos.
            <br />
            <strong>Panel Admin:</strong> interfaz de gestión del Restaurante.
            <br />
            <strong>Procesador de pagos:</strong> Tercero que procesa pagos en línea ( Ejm : Culqi , Niubiz, etc).
          </p>

          <h3 className="mt-4 text-sm font-semibold">2.1 Arquitectura de datos (multi-tenant)</h3>
          <p>
            Por el momento, Mikhunapp aloja la información de todos los Tenants en una única base de datos multi-tenant con separación lógica, sin partición física por restaurante. El acceso se controla mediante controles de acceso por roles, filtros por Tenant y políticas a nivel de aplicación y base de datos que impiden que usuarios de un Tenant accedan a datos de otro.
          </p>

          <h2 className="mt-6 text-base font-semibold">3. Aceptación de los Términos</h2>
          <p>
            Al acceder al sitio, crear una cuenta, usar el Panel o escanear un QR, aceptas estos Términos y la{" "}
            <a className="underline" href="/legal/privacidad">Política de Privacidad</a>. Si no estás de acuerdo, no utilices el servicio.
          </p>

          <h2 className="mt-6 text-base font-semibold">4. Cuentas y multi-tenancy</h2>
          <p>
            Cada Restaurante dispone de un Tenant con aislamiento lógico respecto de otros Tenants dentro de una base de datos compartida. El Restaurante es responsable de: (i) la veracidad de su información, (ii) el contenido publicado (precios, fotos, alérgenos, combos), y (iii) la gestión de usuarios y permisos dentro de su Tenant. Está prohibido compartir credenciales o usar el servicio con fines ilícitos o no autorizados.
          </p>

          <h2 className="mt-6 text-base font-semibold">5. Pedidos, pagos y comprobantes</h2>
          <p>
            Los pedidos generados desde el menú digital se reflejan en tiempo real en el Panel/cocina.
            <br />
            Los pagos en línea se procesan a través de la pasarela de pago (Ya sea Culqi , Niubiz u otro); Mikhunapp no almacena datos sensibles de tarjetas (PAN/CVV). Las políticas antifraude y verificaciones del procesador aplican al Restaurante y al Comensal.
            <br />
            La emisión de comprobantes, políticas de cambios/devoluciones, manejo de contracargos y cualquier controversia comercial con el Comensal corresponde exclusivamente al Restaurante frente al proovedor de pagos (Culqi , Niubiz, etc) y/o al consumidor.
          </p>

          <h2 className="mt-6 text-base font-semibold">6. Planes, precios y facturación</h2>
          <p>
            <strong>Plan:</strong> Básico.
            <br />
            <strong>Tarifa:</strong> S/ 300 (trescientos y 00/100 soles) mensuales (IGV incluido).
            <br />
            <strong>Ciclo:</strong> mensual prepagado con renovación automática hasta su cancelación.
            <br />
            <strong>Pago:</strong> mediante los medios habilitados en el Panel.
            <br />
            <strong>Mora:</strong> en caso de impago, se aplica 1% mensual y/o gastos administrativos razonables.
            <br />
            <strong>Suspensión por impago:</strong> a los 7 días calendario de vencida la factura, podremos suspender el acceso; reactivación una vez regularizado el pago.
            <br />
            <strong>Reembolsos:</strong> mes iniciado no reembolsable, salvo error imputable a Mikhunapp o lo que disponga la normativa aplicable.
            <br />
            <strong>Cambios de precio:</strong> se comunicarán con 15 días de anticipación.
          </p>

          <h2 className="mt-6 text-base font-semibold">7. Disponibilidad (SLA) y soporte</h2>
          <p>
            <strong>Objetivo de disponibilidad:</strong> 99.5% mensual (no garantizado) para funcionalidades core.
            <br />
            <strong>Mantenimientos programados:</strong> aviso con 48 h cuando sea posible.
            <br />
            <strong>Soporte:</strong> mikhunappfood@gmail.com y +51 950809208, L-V 09:00–18:00 (PET).
            <br />
            <strong>Exclusiones:</strong> caídas de terceros (proveedor cloud, ISP, (Culqi u otra pasarela de pago)), fuerza mayor y eventos fuera de nuestro control razonable.
          </p>

          <h2 className="mt-6 text-base font-semibold">8. Seguridad y continuidad</h2>
          <p>
            Implementamos medidas razonables de seguridad: cifrado TLS en tránsito, control de acceso por roles y separación lógica por Tenant mediante validaciones a nivel de aplicación y base de datos.
          </p>
          <p>
            <strong>Transparencia:</strong> Por ahora no garantizamos la realización de copias de seguridad automáticas ni la conservación de registros de actividad por plazos específicos. Recomendamos al Restaurante conservar respaldos propios de la información relevante y, si lo requiere, solicitar una exportación de datos conforme a la sección 12.
            <br />
            Ante un incidente de seguridad que afecte datos del Tenant, notificaremos sin dilación indebida a los contactos del Restaurante registrados en el Panel.
          </p>

          <h3 className="mt-4 text-sm font-semibold">8.1 Evolución de la arquitectura</h3>
          <p>
            Mikhunapp podrá incorporar backups automáticos, registros de actividad y exportación self-service en el futuro, o migrar a partición física por razones de seguridad, rendimiento o cumplimiento, sin afectar la continuidad. Cambios de este tipo no implicarán variación económica salvo que el Restaurante solicite recursos dedicados o acuerdos específicos, lo que se regulará por anexo.
          </p>

          <h2 className="mt-6 text-base font-semibold">9. Datos personales (Perú)</h2>
          <p>
            Tratamos datos conforme a la Ley N.º 29733 y su Reglamento.
            <br />
            Respecto de los datos de Comensales, el Restaurante es responsable del banco de datos y del cumplimiento de derechos ARCO; Mikhunapp actúa como encargado de tratamiento.
            <br />
            Encargados y subencargados: podemos recurrir a proveedores (p. ej., cloud, analítica,(Culqi u otra pasarela de pago)).
            <br />
            Si existieran transferencias internacionales de datos, se realizarán con garantías adecuadas.
            <br />
            <strong>Base de datos compartida:</strong> el tratamiento se realiza en una base de datos multi-tenant compartida con controles de segregación lógica por Tenant.
          </p>

          <h2 className="mt-6 text-base font-semibold">10. Contenidos y propiedad intelectual</h2>
          <p>
            El software, marcas y diseños de Mikhunapp son de Gerimi Angelo Oroncoy Cordova. El Restaurante conserva titularidad sobre su contenido (menú, fotos, logos) y nos otorga una licencia no exclusiva para usarlo a efectos de operar la plataforma. El feedback que nos proporciones podrá ser utilizado libremente para mejorar el servicio, sin obligación de reconocimiento o pago.
          </p>

          <h3 className="mt-4 text-sm font-semibold">10.1 Uso de marcas y referencias</h3>
          <p>
            Salvo indicación en contrario por escrito, el Restaurante autoriza a Mikhunapp a mencionar su nombre y logo como cliente en materiales comerciales. Podrá solicitar opt-out en cualquier momento.
          </p>

          <h2 className="mt-6 text-base font-semibold">11. Uso permitido y uso prohibido</h2>
          <ul className="list-disc pl-5">
            <li>Vulnerar o intentar vulnerar la seguridad del sistema.</li>
            <li>Descompilar, realizar ingeniería inversa o crear obras derivadas.</li>
            <li>Usar scrapers o automatizaciones que afecten la estabilidad.</li>
            <li>Enviar spam, phishing o contenido ilícito/engañoso.</li>
            <li>Interferir con otros Tenants o con la infraestructura del servicio.</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold">12. Portabilidad y borrado de datos</h2>
          <p>
            Al terminar la relación o cuando el Restaurante lo solicite:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Exportación bajo solicitud:</strong> El Restaurante puede solicitar una exportación única de sus datos en CSV/JSON mediante mikhunappfood@gmail.com o +51 950809208 . Mikhunapp la entregará en un plazo de hasta 10 días hábiles desde la verificación de titularidad y con alcance razonable a la información operativa del Tenant (pedidos, productos, mesas y usuarios).
            </li>
            <li>
              <strong>Conservación temporal:</strong> Tras la terminación, podremos conservar los datos por hasta 30 días únicamente para completar la exportación si fue solicitada.
            </li>
            <li>
              <strong>Eliminación:</strong> Luego de ese plazo, Mikhunapp eliminará los datos operativos del Tenant en un máximo de 90 días, salvo conservación legal obligatoria.
            </li>
          </ul>

          <h2 className="mt-6 text-base font-semibold">13. Libro de Reclamaciones y consumidor</h2>
          <p>
            Contamos con Libro de Reclamaciones Virtual conforme a la normativa peruana. Las reclamaciones sobre calidad de platos, tiempos, stock o experiencia gastronómica corresponden al Restaurante, aplicándose el Código de Protección y Defensa del Consumidor (Ley N.º 29571).
          </p>

          <h2 className="mt-6 text-base font-semibold">14. Relación comercial e intermediación</h2>
          <p>
            Mikhunapp no intermedia ventas de comida ni actúa como comerciante frente al Comensal. El Restaurante es el vendedor y responsable de la relación de consumo.
          </p>

          <h2 className="mt-6 text-base font-semibold">15. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por ley: (a) Mikhunapp no responde por daños indirectos, lucro cesante, pérdida de datos no atribuible a incumplimiento nuestro ni por decisiones comerciales del Restaurante; (b) nuestra responsabilidad total acumulada se limita al monto efectivamente pagado a Mikhunapp por el Restaurante en los 12 meses anteriores al hecho que dio lugar al reclamo.
          </p>

          <h2 className="mt-6 text-base font-semibold">16. Suspensión y terminación</h2>
          <p>
            Podremos suspender o terminar el servicio, total o parcialmente, si: (i) hay impago, (ii) hay uso prohibido o ilícito, (iii) existen riesgos para la seguridad o estabilidad del sistema, o (iv) se incumplen estos Términos. En suspensiones por impago, podremos mantener —si es técnicamente posible— acceso de solo lectura temporal para facilitar la exportación (sección 12).
          </p>

          <h2 className="mt-6 text-base font-semibold">17. Modificaciones</h2>
          <p>
            Podemos actualizar estos Términos publicando la nueva fecha de vigencia en <strong>mikhunapp.com</strong>. Si el cambio es material (p. ej., económico), podrás resolver el contrato sin penalidad antes de su entrada en vigor.
          </p>

          <h2 className="mt-6 text-base font-semibold">18. Comunicaciones</h2>
          <p>
            Las notificaciones se enviarán a los correos/medios registrados en el Panel. Se considerarán recibidas a las 24 h de remitidas o al primer acceso posterior del Restaurante al Panel, lo que ocurra primero.
          </p>

          <h2 className="mt-6 text-base font-semibold">19. Ley aplicable y jurisdicción</h2>
          <p>
            Estos Términos se rigen por las leyes del Perú. Cualquier controversia se someterá a la competencia de los Juzgados de [Lima/Lima].
          </p>

          <h2 className="mt-6 text-base font-semibold">20. Contacto</h2>
          <p>
            <strong>Correo:</strong> mikhunappfood@gmail.com
            <br />
            <strong>WhatsApp/Tel.:</strong> +51 950809208
            <br />
            <strong>Domicilio:</strong> Lima - Ate - Vitarte 3ra Etapa Ceres
          </p>

          <h2 className="mt-6 text-base font-semibold">Anexo I – Acuerdo de Encargo de Tratamiento (resumen)</h2>
          <p>
            Finalidad: prestación del servicio Mikhunapp; 2) Instrucciones documentadas del Restaurante; 3) Confidencialidad; 4) Medidas de seguridad razonables; 5) Subencargados autorizados (cloud, Culqi, analítica); 6) Asistencia para derechos ARCO; 7) Notificación de incidentes; 8) Supresión o devolución de datos al terminar; 9) Auditorías razonables.
          </p>
        </section>
      </div>
    </main>
  );
}

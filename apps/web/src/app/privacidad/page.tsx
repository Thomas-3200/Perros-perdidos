import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad — Perros Perdidos',
  description: 'Política de privacidad de la plataforma Perros Perdidos',
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6">
        <div>
          <Link href="/" className="text-sm text-brand-600 hover:underline">← Volver al inicio</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Política de Privacidad</h1>
          <p className="text-sm text-gray-500 mt-1">Última actualización: mayo de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">1. Información que recopilamos</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Recopilamos la información que usted nos proporciona directamente al usar nuestra plataforma,
            incluyendo nombre, dirección de correo electrónico, número de teléfono (opcional), fotografías
            de mascotas y ubicación geográfica cuando se reportan casos de perros perdidos o avistamientos.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Si inicia sesión con Facebook, recibimos su nombre, dirección de correo electrónico y foto de
            perfil de acuerdo con los permisos que usted otorga.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">2. Cómo usamos la información</h2>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside leading-relaxed">
            <li>Crear y gestionar su cuenta de usuario</li>
            <li>Publicar reportes de perros perdidos y avistamientos</li>
            <li>Enviar notificaciones cuando se detectan posibles coincidencias</li>
            <li>Mejorar nuestro sistema de inteligencia artificial para la reunificación de mascotas</li>
            <li>Comunicarnos con usted sobre el estado de los casos</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">3. Compartición de datos</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            No vendemos ni compartimos su información personal con terceros con fines comerciales.
            Los datos de contacto asociados a reportes de perros perdidos son visibles para usuarios
            registrados de la plataforma con el fin exclusivo de facilitar la reunificación.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Utilizamos servicios de terceros (Cloudinary para almacenamiento de imágenes, Anthropic para
            procesamiento de IA, Render para infraestructura) que pueden procesar datos según sus propias
            políticas de privacidad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">4. Fotografías y contenido</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Las fotografías que usted sube son almacenadas de forma segura y utilizadas únicamente para
            identificar y reunificar mascotas. Las imágenes asociadas a casos activos son visibles para
            usuarios registrados. Al cerrar un caso, las fotos permanecen archivadas internamente pero
            no se muestran públicamente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">5. Sus derechos</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Usted tiene derecho a acceder, corregir o eliminar su información personal en cualquier momento.
            Para ejercer estos derechos, contáctenos en{' '}
            <a href="mailto:privacidad@perros-perdidos.app" className="text-brand-600 hover:underline">
              privacidad@perros-perdidos.app
            </a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">6. Seguridad</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Implementamos medidas de seguridad estándar de la industria para proteger su información,
            incluyendo cifrado HTTPS, autenticación mediante tokens JWT y almacenamiento seguro de datos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">7. Cookies y almacenamiento local</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Utilizamos almacenamiento local del navegador (localStorage) para mantener su sesión activa.
            No utilizamos cookies de seguimiento ni publicidad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">8. Cambios a esta política</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Podemos actualizar esta política ocasionalmente. Le notificaremos de cambios significativos
            a través de la plataforma. El uso continuado de nuestros servicios después de los cambios
            constituye su aceptación de la política actualizada.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">9. Contacto</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Si tiene preguntas sobre esta política de privacidad, puede contactarnos en:{' '}
            <a href="mailto:privacidad@perros-perdidos.app" className="text-brand-600 hover:underline">
              privacidad@perros-perdidos.app
            </a>
          </p>
        </section>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            © 2026 Perros Perdidos. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

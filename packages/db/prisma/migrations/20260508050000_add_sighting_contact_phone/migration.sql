-- Agregar campo contactPhone a Sighting
-- Es el teléfono del DUEÑO del perro perdido (extraído por IA del post original
-- al importar de redes sociales), separado del reporter (usuario de la app).

ALTER TABLE "sightings"
ADD COLUMN "contactPhone" TEXT;

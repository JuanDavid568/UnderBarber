## ADDED Requirements

### Requirement: Fotos de los barberos
Cada barbero SHALL mostrarse con una foto vertical (4:5) tomada de `frontend/img/barbers/<especialidad>.jpg` (`fade`, `classic`, `creative`), en la sección Equipo y en el resultado del cuestionario.

#### Scenario: Foto disponible
- **WHEN** existe el archivo de la foto del barbero
- **THEN** se muestra recortada y centrada en la cara, con texto alternativo con su nombre

#### Scenario: Foto ausente
- **WHEN** el archivo no existe o no carga
- **THEN** se muestra el emblema de su especialidad en su lugar

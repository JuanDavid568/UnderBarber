// Se ejecuta antes de pintar la página: si ya viste la portada en esta visita, o entraste a una sección
// concreta (por ejemplo #reservar o #/cuenta), no la vuelve a mostrar.
(function () {
  var skip = false;
  try { skip = sessionStorage.getItem("underbarber.cover") === "1"; } catch (e) { /* almacenamiento bloqueado */ }
  if (skip || location.hash) document.documentElement.classList.add("no-cover");
})();

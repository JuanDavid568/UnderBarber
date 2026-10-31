// Cliente de la API + sesión (el token se guarda en localStorage si el navegador lo permite).
const KEY = "underbarber.session";
let memory = null;

export const session = {
  get() {
    if (memory) return memory;
    try {
      memory = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      memory = null;
    }
    return memory;
  },
  set(value) {
    memory = value;
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch {
      /* navegación privada o almacenamiento bloqueado: la sesión vive solo en memoria */
    }
  },
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, body) {
  const headers = { Accept: "application/json" };
  const s = session.get();
  if (s && s.token) headers.Authorization = `Bearer ${s.token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "No pudimos conectar con el servidor. Revisa tu internet e inténtalo de nuevo.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  if (!res.ok) {
    if (res.status === 401 && s && path !== "/auth/login") onUnauthorized();
    throw new ApiError(res.status, (data && data.error) || "Algo salió mal. Inténtalo de nuevo.");
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b ?? {}),
  patch: (p, b) => request("PATCH", p, b ?? {}),
  put: (p, b) => request("PUT", p, b ?? {}),
  del: (p) => request("DELETE", p),
};

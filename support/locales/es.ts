/** Visible text of the app in Spanish, as the tests find it on screen. */
export const es = {
  auth: {
    emailLabel: "Email",
    passwordLabel: "Contraseña",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
  },
  login: {
    heading: "Iniciar sesión",
    submit: "Entrar",
    registerLink: "Regístrate",
    invalidCredentials: "Email o contraseña incorrectos.",
  },
  register: {
    heading: "Crear cuenta",
    submit: "Crear cuenta",
    passwordHint: "Mínimo 6 caracteres.",
    loginLink: "Inicia sesión",
    emailTaken: "Ya existe una cuenta con ese email.",
    confirmationHeading: "Revisa tu email",
    goToLoginLink: "Ir a iniciar sesión",
  },
  shell: {
    logout: "Cerrar sesión",
  },
  modules: {
    today: {
      navLink: "Hoy",
      title: "Entrada del día",
      cardLink: (moduleTitle: string) => `Ir a ${moduleTitle}`,
    },
    habits: {
      navLink: "Hábitos",
      title: "Hábitos",
      tabsLabel: "Secciones de hábitos",
      tabs: { daily: "Diario", progress: "Progreso", gym: "Gym" },
    },
    finance: {
      navLink: "Finanzas",
      title: "Finanzas",
      description: "Tus ingresos y gastos del mes.",
    },
    watchlist: {
      navLink: "Watchlist",
      title: "Watchlist",
      description: "Películas y series por ver.",
    },
  },
};

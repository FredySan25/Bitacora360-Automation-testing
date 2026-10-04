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
    confirmationLinkInvalid:
      "Ese enlace de confirmación ya no es válido o ya se usó. Si ya confirmaste tu cuenta, inicia sesión.",
  },
  register: {
    heading: "Crear cuenta",
    submit: "Crear cuenta",
    passwordHint: "Mínimo 6 caracteres.",
    loginLink: "Inicia sesión",
    emailTaken: "Ya existe una cuenta con ese email.",
    confirmationHeading: "Revisa tu email",
    goToLoginLink: "Ir a iniciar sesión",
    codeLabel: "Código de verificación",
    verifySubmit: "Confirmar código",
    resendCode: "Reenviar código",
    codeResent: "Te enviamos un código nuevo.",
    invalidCode: "El código es incorrecto o ya expiró. Revísalo o pide uno nuevo.",
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
      newHabit: "Nuevo hábito",
      nameLabel: "Nombre",
      createSubmit: "Crear hábito",
      saveSubmit: "Guardar",
      cancel: "Cancelar",
      archive: "Archivar",
      restore: "Restaurar",
      delete: "Eliminar",
      editHabit: (name: string) => `Editar ${name}`,
      // Indexed like Date.getDay(): Sunday first
      weekdays: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
      everyDay: "Todos los días",
      otherDays: "Otros días",
      noWeekdays: "Elige al menos un día.",
      streak: (days: number) => `Racha de ${days} ${days === 1 ? "día" : "días"}`,
      deleteConfirm: (name: string) =>
        `¿Eliminar "${name}" y todo su historial? Esta acción no se puede deshacer.`,
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

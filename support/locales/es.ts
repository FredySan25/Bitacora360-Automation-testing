// Indexed from January, as the app writes them
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];

/** Numbers of a "YYYY-MM" or "YYYY-MM-DD" key. */
function keyParts(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

// The app shows every amount in US dollars, whatever the language
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const DELETE_WARNING = "Esta acción no se puede deshacer.";

/** Visible text of the app in Spanish, as the tests find it on screen. */
export const es = {
  dates: {
    /** "marzo", from "1950-03" or "1950-03-31". */
    month: (key: string) => MONTHS[keyParts(key).month - 1],
    /** "mar" */
    shortMonth: (key: string) => SHORT_MONTHS[keyParts(key).month - 1],
    /** "marzo de 1950" */
    monthYear: (key: string) => `${MONTHS[keyParts(key).month - 1]} de ${keyParts(key).year}`,
    /** "31 mar" */
    shortDay: (key: string) => `${keyParts(key).day} ${SHORT_MONTHS[keyParts(key).month - 1]}`,
    /** "31 mar 1950" */
    mediumDay: (key: string) =>
      `${keyParts(key).day} ${SHORT_MONTHS[keyParts(key).month - 1]} ${keyParts(key).year}`,
    /** "31 de marzo de 1950" */
    longDay: (key: string) =>
      `${keyParts(key).day} de ${MONTHS[keyParts(key).month - 1]} de ${keyParts(key).year}`,
  },
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
    aboutLink: "Acerca de",
  },
  // The public page with the credits of the catalogs
  about: {
    documentTitle: "Acerca de · Bitácora360",
    heading: "Acerca de Bitácora360",
    sections: {
      what: "Qué es",
      moviesAndSeries: "Películas y series",
      books: "Libros",
    },
    tmdbLogo: "Logo de TMDB",
    tmdbLink: "TMDB",
    tmdbNotice:
      "Este producto usa la API de TMDB, pero no está respaldado ni certificado por TMDB.",
    // TMDB asks for its notice in English too
    tmdbNoticeInEnglish: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    googleBooksLink: "Google Books",
    openLibraryLink: "Open Library",
    backLink: "← Volver a Bitácora360",
  },
  // The modal that asks before deleting; each screen names its own confirm button
  dialog: {
    cancel: "Cancelar",
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
      progress: {
        tiles: {
          today: "Hoy",
          last7Days: "Últimos 7 días",
          last30Days: "Últimos 30 días",
          bestActiveStreak: "Mejor racha activa",
        },
        charts: {
          weekly: "Cumplimiento por semana",
          daily: "Día a día",
          perHabit: "Por hábito",
        },
        heatmapLabel: "Mapa de calor del cumplimiento diario de las últimas semanas",
        days: (count: number) => `${count} ${count === 1 ? "día" : "días"}`,
        nothingScheduled: "—",
      },
      gym: {
        dateLabel: "Fecha",
        titleLabel: "Título (opcional)",
        createSubmit: "Registrar entrenamiento",
        defaultTitle: "Entrenamiento",
        showMore: "Ver más",
        deleteWorkout: "Eliminar entrenamiento",
        deleteWorkoutConfirm: "¿Eliminar este entrenamiento con todas sus series?",
        noSets: "Aún no hay series. Registra la primera.",
        exerciseLabel: "Ejercicio",
        repsLabel: "Reps",
        weightLabel: "Peso (kg)",
        addSet: "Agregar serie",
        // The weight comes formatted as the app shows it: a comma for decimals ("62,5")
        weightedSet: (reps: number, weight: string) => `${reps} × ${weight} kg`,
        bodyweightSet: (reps: number) => `${reps} reps`,
        deleteSet: (set: string) => `Eliminar serie ${set}`,
        progressHeading: "Progreso por ejercicio",
        bestMark: (value: string) => `Mejor marca: ${value}`,
      },
    },
    finance: {
      navLink: "Finanzas",
      title: "Finanzas",
      description: "Tus ingresos y gastos del mes.",
      tabsLabel: "Secciones de finanzas",
      tabs: {
        transactions: "Movimientos",
        budgets: "Presupuestos",
        summary: "Resumen",
        goals: "Metas",
      },
      /** "$1,250.50", or "-$20.00" below zero. */
      money: (value: number) => usd.format(value),
      /** Shape of any amount, for the totals a test cannot know beforehand. */
      moneyPattern: /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/,
      /** Like `money`, but an amount above zero carries its sign: "+$120.00". */
      signedMoney: (value: number) => (value > 0 ? `+${usd.format(value)}` : usd.format(value)),
      /** "42 %" */
      percent: (value: number) => `${value} %`,
      /** Like `percent`, but a rise carries its sign: "+50 %". */
      signedPercent: (value: number) => (value > 0 ? `+${value} %` : `${value} %`),
      cancel: "Cancelar",
      saveSubmit: "Guardar",
      confirmDelete: "Eliminar",
      saveError: "No pudimos guardar el cambio. Revisa tu conexión e intenta de nuevo.",
      monthNav: {
        previous: "Mes anterior",
        next: "Mes siguiente",
        current: "Mes actual",
      },
      types: {
        expense: { label: "Gasto", plural: "Gastos" },
        income: { label: "Ingreso", plural: "Ingresos" },
      },
      // Both in the order the app lists them
      expenseCategories: {
        food: "Comida",
        transport: "Transporte",
        housing: "Vivienda",
        utilities: "Servicios",
        health: "Salud",
        education: "Educación",
        debt: "Deudas",
        entertainment: "Entretenimiento",
        shopping: "Compras",
        subscriptions: "Suscripciones",
        other: "Otros",
      },
      incomeCategories: {
        salary: "Salario",
        freelance: "Freelance",
        gift: "Regalos",
        other: "Otros",
      },
      cards: {
        income: "Ingresos",
        expenses: "Gastos",
        balance: "Balance",
        savingsRate: "Tasa de ahorro",
        // The change takes the name of the month before alone: "febrero"
        change: (change: string, month: string) => `${change} vs. ${month}`,
        sameAs: (month: string) => `Igual que en ${month}`,
        noIncomeIn: (month: string) => `Sin ingresos en ${month}`,
        noExpensesIn: (month: string) => `Sin gastos en ${month}`,
        noTransactionsIn: (month: string) => `Sin movimientos en ${month}`,
        noRate: "—",
        rateWithoutIncome: "Sin ingresos en el mes",
        rateOverspent: "Gastaste más de lo que ingresó",
        rateOfIncome: "del ingreso del mes",
      },
      transactions: {
        loadError: "No pudimos cargar tus movimientos. Recarga la página para intentar de nuevo.",
        newTransaction: "Nuevo movimiento",
        listHeading: "Movimientos",
        typeLegend: "Tipo",
        amountLabel: "Monto",
        categoryLabel: "Categoría",
        dateLabel: "Fecha",
        noteLabel: "Nota (opcional)",
        createSubmit: "Agregar movimiento",
        edit: "Editar movimiento",
        delete: "Eliminar movimiento",
        // The sign is a typographic minus (U+2212), not a hyphen
        expenseAmount: (value: number) => `Gasto: −${usd.format(value)}`,
        incomeAmount: (value: number) => `Ingreso: +${usd.format(value)}`,
        /** Day and note of a row: "31 mar · Groceries", or the day alone. */
        detail: (day: string, note?: string) => (note ? `${day} · ${note}` : day),
        // Both take the month with its year: "marzo de 1950"
        empty: (month: string) => `Sin movimientos en ${month}. Anota el primero.`,
        savedElsewhere: (month: string) => `Guardado en ${month}. Cambia de mes para verlo.`,
        filters: {
          typeLabel: "Tipo",
          categoryLabel: "Categoría",
          allTypes: "Todos",
          allCategories: "Todas",
        },
        noMatches: "Ningún movimiento coincide con los filtros.",
        clearFilters: "Quitar filtros",
        deleteTitle: "¿Eliminar este movimiento?",
        deleteMessage: (category: string, amount: string, day: string) =>
          `${category} · ${amount} · ${day}. ${DELETE_WARNING}`,
      },
      budgets: {
        loadError: "No pudimos cargar tus presupuestos. Recarga la página para intentar de nuevo.",
        newBudget: "Nuevo presupuesto",
        categoryLabel: "Categoría",
        limitLabel: "Límite mensual",
        createSubmit: "Crear presupuesto",
        appliesFrom: (month: string) => `Aplica desde ${month} en adelante.`,
        empty: (month: string) =>
          `Sin presupuestos en ${month}. Ponle un límite a la categoría en la que más gastas.`,
        edit: (category: string) => `Editar presupuesto de ${category}`,
        delete: (category: string) => `Eliminar presupuesto de ${category}`,
        progressBar: (category: string) => `Presupuesto de ${category}`,
        states: { ok: "En orden", warning: "Cerca del límite", over: "Excedido" },
        spentOf: (spent: string, limit: string) => `${spent} de ${limit}`,
        /** What the bar announces: "79 %, En orden". */
        progress: (percent: string, state: string) => `${percent}, ${state}`,
        remaining: (percent: string, amount: string) => `${percent} usado · Te quedan ${amount}`,
        exceeded: (percent: string, amount: string) =>
          `${percent} usado · Te pasaste por ${amount}`,
        deleteTitle: (category: string) => `¿Eliminar el presupuesto de ${category}?`,
        deleteMessage:
          "Se quita de todos los meses, también de los anteriores. Tus movimientos no se borran.",
      },
      summary: {
        loadError: "No pudimos cargar tu resumen. Recarga la página para intentar de nuevo.",
        charts: {
          byCategory: "Gastos por categoría",
          trend: "Ingresos y gastos de los últimos 6 meses",
          rule: "Regla 50/30/20",
        },
        categoryShare: (amount: string, percent: string) => `${amount} · ${percent}`,
        noExpenses: (month: string) => `Sin gastos en ${month}.`,
        noTrend: "Aún no hay movimientos en estos meses.",
        trendSeries: ["Ingresos", "Gastos"],
        trendReadout: (income: string, expenses: string, balance: string) =>
          `Ingresos ${income} · Gastos ${expenses} · Balance ${balance}`,
        trendMonth: (month: string, income: string, expenses: string) =>
          `${month}: ingresos ${income}, gastos ${expenses}`,
        // The same numbers as a table, for screen readers
        trendTable: {
          caption: "Ingresos y gastos por mes",
          columns: ["Mes", "Ingresos", "Gastos", "Balance"],
        },
        rule: {
          needs: "Necesidades",
          wants: "Gustos",
          savings: "Ahorro",
          share: (share: string, amount: string, reference: string) =>
            `${share} del ingreso · ${amount} · referencia ${reference}`,
          noIncome: "Registra un ingreso en este mes para ver cómo se reparte.",
          explanation:
            "Necesidades: comida, transporte, vivienda, servicios, salud, educación, deudas. " +
            "Gustos: entretenimiento, compras, suscripciones, otros. " +
            "Ahorro: lo que queda del ingreso después de los gastos.",
        },
      },
      goals: {
        loadError: "No pudimos cargar tus metas. Recarga la página para intentar de nuevo.",
        empty: "Aún no tienes metas de ahorro. Un fondo de emergencia es un buen comienzo.",
        newGoal: "Nueva meta",
        nameLabel: "Nombre",
        targetLabel: "Monto objetivo",
        targetDateLabel: "Fecha objetivo (opcional)",
        createSubmit: "Crear meta",
        edit: (name: string) => `Editar meta ${name}`,
        delete: (name: string) => `Eliminar meta ${name}`,
        // The days come as the app shows them: "8 oct 2026"
        deadline: (day: string) => `Para el ${day}`,
        savedOf: (saved: string, target: string) => `${saved} de ${target}`,
        progressBar: (name: string) => `Avance de ${name}`,
        remaining: (amount: string) => `Te faltan ${amount}`,
        reached: "Meta cumplida",
        deadlinePassed: "La fecha objetivo ya pasó.",
        monthlySaving: (amount: string) => `Ahorra ${amount} al mes para llegar a tiempo.`,
        contributionLabel: "Aporte",
        contributionDateLabel: "Fecha",
        contribute: "Aportar",
        contributions: (count: number) => `Aportes (${count})`,
        deleteContribution: (amount: string, day: string) =>
          `Eliminar aporte de ${amount} del ${day}`,
        deleteContributionTitle: "¿Eliminar este aporte?",
        deleteContributionMessage: (amount: string, goal: string) =>
          `${amount} de "${goal}". ${DELETE_WARNING}`,
        deleteTitle: (name: string) => `¿Eliminar la meta "${name}"?`,
        deleteMessage: (contributions: number) =>
          contributions === 0
            ? DELETE_WARNING
            : `Se elimina junto con ${
                contributions === 1 ? "su aporte" : `sus ${contributions} aportes`
              }. ${DELETE_WARNING}`,
      },
      todayCard: {
        empty: "Sin movimientos este mes. Anota tu primer gasto.",
        emptyAction: "+ Registrar gasto",
        loadError: "No pudimos cargar tus movimientos.",
        balanceLabel: "Balance del mes",
        incomeLabel: "Ingresos",
        expensesLabel: "Gastos",
      },
    },
    watchlist: {
      navLink: "Watchlist",
      title: "Watchlist",
      description: "Películas, series y libros por ver y leer.",
      loading: "Cargando tu lista...",
      loadError: "No pudimos cargar tu lista. Recarga la página para intentar de nuevo.",
      saveError: "No pudimos guardar el cambio. Revisa tu conexión e intenta de nuevo.",
      empty: "Tu lista está vacía. Agrega la próxima película, serie o libro.",
      filterLegend: "Filtrar por tipo",
      allTypes: "Todo",
      // The keys are the ones the app saves
      types: {
        movie: { label: "Película", plural: "Películas" },
        series: { label: "Serie", plural: "Series" },
        book: { label: "Libro", plural: "Libros" },
      },
      /** A filter without items, from the plural of its type: "No tienes películas en tu lista." */
      noneOfType: (plural: string) => `No tienes ${plural.toLowerCase()} en tu lista.`,
      addTitle: "Agregar título",
      newTitle: "Nuevo título",
      typeLegend: "Tipo",
      titleLabel: "Título",
      statusLabel: "Estado",
      // Books are read, movies and series are watched
      statuses: {
        movie: { pending: "Por ver", in_progress: "Viendo", done: "Vista" },
        series: { pending: "Por ver", in_progress: "Viendo", done: "Vista" },
        book: { pending: "Por leer", in_progress: "Leyendo", done: "Leído" },
      },
      finishedOnLabel: "Terminado el",
      ratingLegend: "Calificación (opcional)",
      stars: (count: number) => (count === 1 ? "1 estrella" : `${count} estrellas`),
      clearRating: "Quitar calificación",
      reviewLabel: "Reseña (opcional)",
      createSubmit: "Agregar",
      saveSubmit: "Guardar",
      saving: "Guardando...",
      cancel: "Cancelar",
      // In the order the board shows them
      sections: { in_progress: "En curso", pending: "Pendientes", done: "Terminados" },
      /** "Pendientes (3)" */
      sectionHeading: (section: string, count: number) => `${section} (${count})`,
      /** A section heading with any count, which the other tests change. */
      sectionHeadingPattern: (section: string) => new RegExp(`^${section} \\(\\d+\\)$`),
      /** Line under the title: "Película · Por ver", or "Libro · Leído el 14 oct 2026" once finished. */
      detail: (type: string, status: string, finishedOn?: string) =>
        finishedOn ? `${type} · ${status} el ${finishedOn}` : `${type} · ${status}`,
      review: (note: string) => `“${note}”`,
      edit: (title: string) => `Editar ${title}`,
      delete: (title: string) => `Eliminar ${title}`,
      ratingOf: (title: string) => `Calificación de ${title}`,
      start: { watch: "Empezar a ver", read: "Empezar a leer" },
      finish: { watch: "Marcar como vista", read: "Marcar como leído" },
      deleteTitle: (title: string) => `¿Eliminar "${title}"?`,
      deleteMessage: DELETE_WARNING,
      confirmDelete: "Eliminar",
      // Books have a cover; movies and series, a poster. `type` is a key of `types`
      poster: (title: string, type: string) =>
        `${type === "book" ? "Portada" : "Póster"} de ${title}`,
      /** The stand-in of an item without a poster, or whose poster fails to load. */
      noPoster: (title: string, type: string) =>
        `${type === "book" ? "Sin portada" : "Sin póster"}: ${title}`,
      /** The line under the board, before its link. */
      attribution: "Pósters y datos de TMDB, Google Books y Open Library",
      creditsLink: "Créditos",
      catalog: {
        suggestionsLabel: "Sugerencias para título",
        /** Line under a suggestion: "2001 · Gabriel García Márquez", or either alone. */
        suggestionDetail: (year: number | null, byline: string | null) =>
          [year, byline].filter(Boolean).join(" · "),
        searching: "Buscando en el catálogo...",
        noResults: "Sin resultados en el catálogo; puedes agregarlo igual.",
        searchError: "No pudimos buscar en el catálogo. Puedes escribir el título a mano.",
        // The keys are the ones the app saves
        sources: { tmdb: "TMDB", google_books: "Google Books", open_library: "Open Library" },
        fromCatalog: (source: string) => `Del catálogo de ${source}`,
        // Drops the whole link: poster, year and id
        removeLink: "Quitar del catálogo",
      },
      todayCard: {
        loadError: "No pudimos cargar tu lista.",
        empty: "Tu lista está vacía. ¿Qué quieres ver o leer después?",
        emptyAction: "+ Agregar título",
        inProgress: "En curso",
        nothingInProgress: "Nada en curso por ahora.",
        more: (count: number) => `y ${count} más`,
        pendingLabel: "Pendientes",
        doneLabel: "Terminados",
      },
    },
  },
};

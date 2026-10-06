/**
 * All visible text of the site (ES / EN). Content, figures, plan and testimonials come from
 * the current mimattpro.com — nothing invented. The trading scene is labeled as a simulation.
 */
const p = (es: string, en: string) => ({ es, en })

export const links = {
  /** where the login form posts (the platform's own server-side login: fields email, password, remember_me) */
  loginAction: 'https://mimattpro.com/login',
  login: '/login/',
  signup: 'https://mimattpro.com/signup',
  monthly: 'https://mimattpro.com/signup?offer=monthly',
  masterclass: 'https://mimattpro.com/masterclass/cupo',
}

export const ui = {
  nav: {
    items: [
      { id: 'platform', label: p('Plataforma', 'Platform') },
      { id: 'about', label: p('Quiénes somos', 'Who we are') },
      { id: 'how', label: p('Cómo funciona', 'How it works') },
      { id: 'markets', label: p('Mercados', 'Markets') },
      { id: 'pricing', label: p('Planes', 'Pricing') },
      { id: 'faq', label: p('FAQ', 'FAQ') },
    ],
    login: p('Ingresar', 'Login'),
    start: p('Empezar', 'Start now'),
    language: p('Idioma', 'Language'),
    menu: p('Menú', 'Menu'),
  },

  preloader: {
    loading: p('Cargando', 'Loading'),
    skip: p('Saltar', 'Skip'),
  },

  hero: {
    kicker: p('Plataforma algorítmica para el mercado de futuros', 'Algorithmic platform for the futures market'),
    title1: p('Donde el algoritmo', 'Where the algorithm'),
    title2: p('ve lo que otros no.', 'sees what others miss.'),
    lead: p(
      'El mercado habla. Nosotros lo traducimos en señales, contexto y herramientas hechas para traders de futuros.',
      'The market speaks. We translate it into signals, context, and tools built for futures traders.',
    ),
    sub: p(
      'Order flow, liquidez, estructura y entradas accionables. Menos ruido. Más señal. Más claridad.',
      'Order flow, liquidity, structure, and actionable entries. Less noise. More signal. More clarity.',
    ),
    start: p('Empezar ahora', 'Start now'),
    explore: p('Explorar la plataforma', 'Explore the platform'),
    masterclass: p('Masterclass gratuita', 'Free masterclass'),
  },

  /** Hero trading scene (simulated, never real results). */
  scene: {
    disclaimer: p('Simulación ilustrativa · no representa resultados reales', 'Illustrative simulation · not real results'),
    workspace: p('Trading Workspace', 'Trading Workspace'),
    booting: p('Iniciando plataforma…', 'Starting platform…'),
    bootSteps: [p('Conectando data de futuros', 'Connecting futures data'), p('Calibrando radar de liquidez', 'Calibrating liquidity radar'), p('Activando MiMatt Bot', 'Activating MiMatt Bot')],
    radar: p('Radar MiMatt', 'MiMatt Radar'),
    radarSub: p('Liquidez · Order flow', 'Liquidity · Order flow'),
    startBalance: p('Saldo inicial', 'Starting balance'),
    balance: p('Saldo', 'Balance'),
    sessionPnl: p('P&L sesión', 'Session P&L'),
    trades: p('Operaciones', 'Trades'),
    entry: p('Entrada', 'Entry'),
    target: p('Objetivo', 'Target'),
    stop: p('Stop', 'Stop'),
    long: p('LONG · COMPRA', 'LONG · BUY'),
    short: p('SHORT · VENTA', 'SHORT · SELL'),
    // robot messages
    scanning: p('Escaneando flujo de órdenes y liquidez…', 'Scanning order flow and liquidity…'),
    signal: p('¡Señal {side} en {sym}! Entra ahora en {price}', '{side} signal on {sym}! Enter now at {price}'),
    managing: p('Posición abierta. Objetivo {target}', 'Position open. Target {target}'),
    win: p('Objetivo alcanzado: {pnl}', 'Target hit: {pnl}'),
    loss: p('Stop tocado: {pnl}. Disciplina, siguiente setup.', 'Stop hit: {pnl}. Discipline, next setup.'),
    // phone
    phoneConnected: p('MiMatt PRO conectado', 'MiMatt PRO connected'),
    phoneWaiting: p('Esperando la próxima señal', 'Waiting for the next signal'),
    phoneNotif: p('Señal {side} · {sym}', '{side} signal · {sym}'),
    phoneNotifBody: p('Entrada {price} · toca para operar', 'Entry {price} · tap to trade'),
    phoneOrder: p('Orden a mercado', 'Market order'),
    phoneQty: p('Contratos', 'Contracts'),
    buy: p('Comprar', 'Buy'),
    sell: p('Vender', 'Sell'),
    filled: p('Orden ejecutada', 'Order filled'),
    openPnl: p('P&L abierto', 'Open P&L'),
    closed: p('Posición cerrada', 'Position closed'),
    newSession: p('Nueva sesión', 'New session'),
  },

  features: {
    kicker: p('La plataforma', 'The platform'),
    title: p('Todo lo que necesitas para leer el mercado', 'Everything you need to read the market'),
    items: [
      { icon: 'target', title: p('Señales de entrada', 'Entry signals'), text: p('Setups claros para ejecutar con estructura.', 'Clear setups to execute with structure.') },
      { icon: 'flow', title: p('Lectura de order flow', 'Order flow reading'), text: p('Flujo comprador y vendedor en tiempo real.', 'Buyer and seller flow in real time.') },
      { icon: 'context', title: p('Contexto institucional', 'Institutional context'), text: p('Niveles y narrativa del mercado institucional.', 'Institutional market levels and narrative.') },
      { icon: 'alert', title: p('Alertas en tiempo real', 'Real-time alerts'), text: p('Alertas oportunas para no llegar tarde.', 'Timely alerts so you are never late.') },
    ],
  },

  about: {
    kicker: p('Quiénes somos', 'Who we are'),
    title: p('Hecho para traders que quieren claridad, no ruido.', 'Built for traders who want clarity, not noise.'),
    text1: p(
      'MiMatt PRO nació para ofrecer una lectura más inteligente del mercado de futuros a través de análisis visual, algorítmico y estructural.',
      'MiMatt PRO was created to deliver a more intelligent reading of the futures market through visual, algorithmic, and structural analysis.',
    ),
    text2: p(
      'Nos enfocamos en lo que de verdad mueve el precio: liquidez, order flow, momentum, intención del mercado y contexto operable.',
      'We focus on what truly drives price behavior: liquidity, order flow, momentum, market intent, and tradable context.',
    ),
    whatKicker: p('Qué hacemos', 'What we do'),
    whatTitle: p('Convertimos datos de mercado en decisiones accionables.', 'We transform market data into actionable decisions.'),
    what: [
      { title: p('Generación de señales', 'Signal generation'), text: p('Entradas accionables respaldadas por estructura y comportamiento.', 'Actionable entries supported by structure and behavior.') },
      { title: p('Análisis de liquidez y flujo', 'Liquidity and flow analysis'), text: p('Lee dónde reacciona el mercado y por qué.', 'Read where the market is reacting and why.') },
      { title: p('Experiencia visual para el trader', 'Trader-focused visual experience'), text: p('Una plataforma diseñada para decidir más rápido y mejor.', 'A platform designed to help you decide faster and better.') },
    ],
    quote: p('El mercado deja huellas. MiMatt PRO te ayuda a leerlas.', 'The market leaves footprints. MiMatt PRO helps you read them.'),
  },

  how: {
    kicker: p('Cómo funciona', 'How it works'),
    title: p('3 pasos para operar con ventaja', '3 steps to trade with an edge'),
    step: p('Paso', 'Step'),
    steps: [
      { title: p('Crea tu cuenta', 'Create your account'), text: p('Regístrate en minutos y define el instrumento principal que quieres seguir.', 'Sign up in minutes and pick the main instrument you want to follow.') },
      { title: p('Accede a señales, análisis y alertas', 'Get signals, analysis and alerts'), text: p('Recibe contexto institucional, flujo de liquidez y zonas clave en tiempo real.', 'Receive institutional context, liquidity flow and key zones in real time.') },
      { title: p('Opera en tu broker con ventaja', 'Trade in your broker with an edge'), text: p('Ejecuta con claridad usando estructura, niveles y confirmaciones del sistema.', 'Execute with clarity using structure, levels and system confirmations.') },
    ],
  },

  markets: {
    kicker: p('Mercados cubiertos', 'Markets covered'),
    title: p('Instrumentos disponibles', 'Available instruments'),
    status: { active: p('Activo', 'Active'), beta: p('Beta', 'Beta'), dev: p('En desarrollo', 'In development') },
    items: [
      { sym: 'ES', name: p('E-mini S&P 500', 'E-mini S&P 500'), status: 'active' },
      { sym: 'NQ', name: p('E-mini Nasdaq-100', 'E-mini Nasdaq-100'), status: 'active' },
      { sym: 'YM', name: p('E-mini Dow', 'E-mini Dow'), status: 'active' },
      { sym: 'CL', name: p('Petróleo crudo', 'Crude oil'), status: 'beta' },
      { sym: 'GC', name: p('Oro', 'Gold'), status: 'beta' },
      { sym: 'RTY', name: p('E-mini Russell 2000', 'E-mini Russell 2000'), status: 'dev' },
    ] as const,
  },

  trust: {
    kicker: p('Confianza', 'Trust'),
    title: p('Traders que operan con MiMatt PRO', 'Traders who trade with MiMatt PRO'),
    stats: [
      { value: '+1,240', label: p('Sesiones analizadas', 'Sessions analyzed') },
      { value: '97%', label: p('Retención mensual', 'Monthly retention') },
      { value: '11ms', label: p('Latencia promedio', 'Average latency') },
      { value: '24/7', label: p('Monitoreo de motores', 'Engine monitoring') },
    ],
    testimonials: [
      { initials: 'MA', name: 'Marcos A.', role: p('Trader de futuros', 'Futures trader'), quote: p('Ahora tengo contexto antes de entrar. Dejé de operar por impulso.', 'Now I have context before I enter. I stopped trading on impulse.') },
      { initials: 'LR', name: 'Laura R.', role: p('Prop desk', 'Prop desk'), quote: p('El mapa de liquidez y los reportes diarios me ahorran horas de análisis.', 'The liquidity map and daily reports save me hours of analysis.') },
      { initials: 'JG', name: 'Juan G.', role: p('Swing ES/NQ', 'Swing ES/NQ'), quote: p('La lectura institucional me dio estructura real para ejecutar con disciplina.', 'The institutional reading gave me real structure to execute with discipline.') },
    ],
  },

  pricing: {
    kicker: p('Planes', 'Bundles'),
    title: p('Elige cómo empezar con MiMatt PRO', 'Choose how you want to start with MiMatt PRO'),
    text: p('Acceso flexible a las herramientas de MiMatt PRO. Elige el plan que mejor se ajuste a ti.', 'Flexible access to MiMatt PRO tools. Choose the plan that fits you best.'),
    plan: p('MiMatt PRO Mensual', 'MiMatt PRO Monthly'),
    planText: p('Acceso flexible a las herramientas de MiMatt PRO.', 'Flexible access to MiMatt PRO tools.'),
    price: '$70',
    per: p('/mes', '/month'),
    includes: [p('1 dispositivo autorizado', '1 authorized device'), p('Trading Workspace', 'Trading Workspace'), p('MiMatt Bridge', 'MiMatt Bridge'), p('Academy', 'Academy')],
    cta: p('Elegir plan mensual', 'Choose monthly'),
    cancel: p('Sin permanencia: cancela cuando quieras desde tu perfil.', 'No lock-in: cancel anytime from your profile.'),
  },

  faq: {
    kicker: p('FAQ', 'FAQ'),
    title: p('Preguntas frecuentes', 'Frequently asked questions'),
    items: [
      { q: p('¿MiMatt PRO ejecuta operaciones por mí?', 'Does MiMatt PRO execute trades for me?'), a: p('No. MiMatt PRO entrega análisis, señales y contexto. Tú decides la ejecución en tu broker.', 'No. MiMatt PRO delivers analysis, signals and context. You decide the execution in your broker.') },
      { q: p('¿Puedo usarlo si soy principiante?', 'Can I use it as a beginner?'), a: p('Sí. El flujo está diseñado para aprender rápido con una lectura clara del mercado.', 'Yes. The flow is designed to learn fast with a clear reading of the market.') },
      { q: p('¿Qué mercados cubre actualmente?', 'Which markets does it cover?'), a: p('ES, NQ, YM, CL, GC y RTY, con distintos estados de disponibilidad.', 'ES, NQ, YM, CL, GC and RTY, with different availability states.') },
      { q: p('¿Necesito NinjaTrader para usar la plataforma?', 'Do I need NinjaTrader to use the platform?'), a: p('Para data en vivo de futuros, sí recomendamos NinjaTrader conectado al bridge.', 'For live futures data, we do recommend NinjaTrader connected to the bridge.') },
      { q: p('¿Cómo recibo las alertas?', 'How do I receive alerts?'), a: p('Desde el dashboard y los canales configurados según tu plan (incluyendo notificaciones directas).', 'From the dashboard and the channels configured for your plan (including direct notifications).') },
      { q: p('¿Puedo cancelar cuando quiera?', 'Can I cancel anytime?'), a: p('Sí, puedes gestionar tu suscripción desde tu perfil sin permanencia obligatoria.', 'Yes, you can manage your subscription from your profile with no lock-in.') },
    ],
  },

  cta: {
    title: p('El mercado deja huellas.', 'The market leaves footprints.'),
    title2: p('Empieza a leerlas hoy.', 'Start reading them today.'),
    start: p('Crear cuenta', 'Create account'),
    login: p('Ya tengo cuenta', 'I have an account'),
  },

  footer: {
    tagline: p('Inteligencia algorítmica para el mercado de futuros.', 'Algorithmic intelligence for the futures market.'),
    platform: p('Plataforma', 'Platform'),
    resources: p('Recursos', 'Resources'),
    legal: p('Legal', 'Legal'),
    terms: p('Términos', 'Terms'),
    privacy: p('Privacidad', 'Privacy'),
    risk: p('Riesgo', 'Risk'),
    create: p('Crear cuenta', 'Create account'),
    riskNotice: p(
      'Aviso legal: el trading de futuros y derivados implica un riesgo significativo de pérdida y no es adecuado para todos los inversionistas. Esta plataforma no ofrece asesoría financiera personalizada. Las animaciones de este sitio son simulaciones ilustrativas y no representan resultados reales ni garantizan resultados futuros.',
      'Legal notice: trading futures and derivatives involves significant risk of loss and is not suitable for all investors. This platform does not offer personalized financial advice. The animations on this site are illustrative simulations; they do not represent actual results nor guarantee future results.',
    ),
  },

  backToTop: p('Volver arriba', 'Back to top'),

  login: {
    pageTitle: p('Ingresar | MiMatt PRO', 'Login | MiMatt PRO'),
    back: p('Volver al inicio', 'Back home'),
    kicker: p('Trading Workspace', 'Trading Workspace'),
    title1: p('Bienvenido de vuelta.', 'Welcome back.'),
    title2: p('El mercado ya está hablando.', 'The market is already talking.'),
    text: p(
      'Entra a tu workspace: señales, order flow, liquidez y contexto institucional en tiempo real.',
      'Enter your workspace: signals, order flow, liquidity and institutional context in real time.',
    ),
    bullets: [p('Señales con estructura, no ruido', 'Signals with structure, not noise'), p('Alertas en tu celular al instante', 'Instant alerts on your phone'), p('Radar de liquidez y order flow', 'Liquidity radar and order flow')],
    marketTitle: p('Mercado ahora', 'Market now'),
    marketNote: p('Datos ilustrativos', 'Illustrative data'),
    cardTitle: p('Ingresar', 'Log in'),
    cardSub: p('Accede a tu cuenta de MiMatt PRO', 'Access your MiMatt PRO account'),
    email: p('Correo electrónico', 'Email address'),
    emailPh: p('tu@correo.com', 'you@email.com'),
    password: p('Contraseña', 'Password'),
    show: p('Mostrar contraseña', 'Show password'),
    hide: p('Ocultar contraseña', 'Hide password'),
    caps: p('Bloq Mayús está activado', 'Caps Lock is on'),
    remember: p('Recordarme', 'Remember me'),
    submit: p('Ingresar', 'Log in'),
    submitting: p('Conectando…', 'Connecting…'),
    noAccount: p('¿Aún no tienes cuenta?', 'No account yet?'),
    create: p('Crear cuenta', 'Create account'),
    errEmail: p('Escribe un correo válido.', 'Enter a valid email.'),
    errPassword: p('Escribe tu contraseña.', 'Enter your password.'),
    secure: p('Conexión cifrada · tus datos van directo a la plataforma', 'Encrypted connection · your data goes straight to the platform'),
    bot: {
      hello: p('¡Hola, trader! ¿Listo para leer el mercado?', 'Hi, trader! Ready to read the market?'),
      email: p('Te sigo…', 'Following you…'),
      shy: p('No estoy mirando, lo prometo 🙈', "I'm not looking, I promise 🙈"),
      peek: p('Bueno… solo un poquito 👀', 'Well… just a peek 👀'),
      error: p('Mmm, revisa los datos.', 'Hmm, check your details.'),
      go: p('¡Vamos al mercado!', "Let's hit the market!"),
    },
  },
}

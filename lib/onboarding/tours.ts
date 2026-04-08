import { OnboardingTour } from "./types";
import { useTranslations } from 'next-intl';

/**
 * Hook that returns onboarding tours with translations applied
 * Use this hook in client-side components
 */
export function useOnboardingTours(): OnboardingTour[] {
  const t = useTranslations('tours');

  return [
    {
      id: "welcome",
      name: t("welcome.name"),
      description: t("welcome.description"),
      requiredForCompletion: true,
      startPage: "/dashboard",
      allowPageChange: true,
      steps: [
        {
          id: "welcome-intro",
          title: t("welcome.steps.intro.title"),
          description: t("welcome.steps.intro.description"),
          position: "bottom",
          requiredPage: "/dashboard",
        },
        {
          id: "welcome-dashboard",
          title: t("welcome.steps.dashboard.title"),
          description: t("welcome.steps.dashboard.description"),
          target: '[data-tour="dashboard-main"]',
          position: "bottom",
          requiredPage: "/dashboard",
        },
        {
          id: "welcome-navigation",
          title: t("welcome.steps.navigation.title"),
          description: t("welcome.steps.navigation.description"),
          target: '[data-tour="sidebar-nav"]',
          position: "right",
          requiredPage: "/dashboard",
        },
        {
          id: "welcome-create",
          title: t("welcome.steps.create.title"),
          description: t("welcome.steps.create.description"),
          target: '[data-tour="create-ai-button"]',
          position: "right",
          requiredPage: "/dashboard",
          interactive: true,
          action: {
            label: t("welcome.steps.create.actionLabel"),
            href: "/constructor",
          },
        },
      ],
    },
    {
      id: "first-agent",
      name: t("firstAgent.name"),
      description: t("firstAgent.description"),
      requiredForCompletion: true,
      startPage: "/constructor",
      allowPageChange: false,
      steps: [
        // STEP 1: NAME INPUT
        {
          id: "agent-name",
          title: t("firstAgent.steps.name.title"),
          description: t("firstAgent.steps.name.description"),
          targets: ['[data-tour="agent-name-input"]', '[data-tour="agent-input"]', '[data-tour="agent-submit"]'],
          position: "bottom",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, escribe un nombre para tu compañero AI y presiona Enter o el botón enviar.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar si hay un nombre en el draft
              const titleElement = document.querySelector('[data-tour="agent-name-input"]');
              if (titleElement && titleElement.textContent) {
                const name = titleElement.textContent.trim();
                return name.length > 0 && name !== 'Sin nombre';
              }
              return false;
            },
            message: "Escribe un nombre único para tu compañero AI",
          },
        },
        // STEP 2: CHARACTER SEARCH - Select, URL, or Manual Description
        {
          id: "agent-character-search",
          title: "Elige Cómo Proporcionar Información",
          description: "Buscamos automáticamente información sobre el nombre que escribiste. Ahora tienes 3 opciones:\n\n**1. Seleccionar un resultado:** Si encuentras al personaje en la lista, haz clic en él.\n\n**2. Pegar URL:** Haz clic en 'Pegar URL', pega el enlace con información del personaje y presiona 'Buscar'. Asegúrate que contenga texto plano.\n\n**3. Describir manualmente:** Haz clic en 'Describir manualmente' y escribe detalles del personaje en el input que aparecerá: dónde vive, con quién interactúa, su historia, etc.\n\n**Nota:** Si te equivocas de opción, aparecerá un botón '← Volver a opciones de búsqueda' para regresar.",
          targets: ['[data-tour="character-search-selector"]'],
          position: "left",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Selecciona y completa una de las opciones para continuar.",
          validation: {
            type: "custom",
            customCheck: () => {
              // The step is only complete when we've actually moved to the personality step
              // This is indicated by the personality question appearing AFTER user completed their choice

              const messagesContainer = document.getElementById('messages-container');
              if (!messagesContainer) return false;

              const messages = messagesContainer.textContent || '';

              // Check if personality prompt has appeared (next step after character selection)
              // AND the search selector is no longer visible (user completed the selection)
              const hasPersonalityPrompt = messages.toLowerCase().includes('personalidad') ||
                                          messages.toLowerCase().includes('personality');

              const searchSelector = document.querySelector('[data-tour="character-search-selector"]');
              const searchSelectorHidden = !searchSelector || window.getComputedStyle(searchSelector).display === 'none';

              // Additional check: make sure user actually submitted something
              // (there should be a user message after the search selection)
              const messageElements = messagesContainer.querySelectorAll('.flex');
              const hasUserResponse = Array.from(messageElements).some((el) => {
                const text = el.textContent || '';
                return text.includes('Seleccioné:') ||
                       text.includes('Quiero describir manualmente') ||
                       text.includes('Buscar en:');
              });

              return hasPersonalityPrompt && searchSelectorHidden && hasUserResponse;
            },
            message: "Selecciona y completa una opción para continuar",
          },
        },
        // STEP 3: PERSONALITY INPUT
        {
          id: "agent-personality-input",
          title: "Define la Personalidad",
          description: "Ahora debes describir la personalidad de tu compañero AI. Sé específico: ¿Es amigable? ¿Serio? ¿Tiene sentido del humor? ¿Es tímido o extrovertido? Esta descripción es fundamental para definir cómo interactuará contigo.\n\nEscribe los detalles en el input y presiona Enter o el botón enviar.",
          targets: ['[data-tour="agent-input"]', '[data-tour="agent-submit"]'],
          position: "bottom",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, describe la personalidad de tu compañero AI y presiona Enter o el botón enviar.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que el usuario haya avanzado al paso de "purpose"
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "propósito" has already been mentioned, it means that personality is completed
                return messages.toLowerCase().includes('propósito') ||
                       messages.toLowerCase().includes('purpose');
              }
              return false;
            },
            message: "Describe la personalidad de tu compañero AI",
          },
        },
        // STEP 4: PURPOSE INPUT
        {
          id: "agent-purpose",
          title: "Define su Propósito",
          description: "¿Para qué quieres usar este compañero AI? ¿Es para conversar? ¿Para que te ayude con tareas? ¿Para compañía emocional? Define claramente su propósito.\n\nEscribe los detalles en el input y presiona Enter o el botón enviar.",
          targets: ['[data-tour="agent-input"]', '[data-tour="agent-submit"]'],
          position: "bottom",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, describe el propósito de tu compañero AI y presiona Enter o el botón enviar.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verify that it has advanced beyond the purpose step
              // El siguiente paso es physical appearance
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "apariencia física" has already been mentioned, it means that purpose is completed
                return messages.toLowerCase().includes('apariencia física') ||
                       messages.toLowerCase().includes('physical appearance') ||
                       messages.toLowerCase().includes('apariencia');
              }
              return false;
            },
            message: "Describe el propósito principal de tu compañero AI",
          },
        },
        // STEP 5: PHYSICAL APPEARANCE SELECTION
        {
          id: "agent-physical-appearance",
          title: "Define la Apariencia Física",
          description: "Ahora elige la apariencia física de tu compañero AI. Tienes varias opciones predefinidas (asiática, latina, caucásica, etc.) o puedes elegir 'Aleatoria' para que el sistema lo decida, o 'Personalizada' para describirla tú mismo.\n\nHaz clic en una de las opciones que aparecen abajo.",
          targets: ['[data-tour="option-selector"]'],
          position: "top",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, selecciona una opción de apariencia física haciendo clic en uno de los botones.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que haya avanzado al paso de avatar
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "avatar" or "foto" has already been mentioned, it means that physical appearance is completed
                return messages.toLowerCase().includes('avatar') ||
                       messages.toLowerCase().includes('foto de cara') ||
                       messages.toLowerCase().includes('imagen de perfil');
              }
              return false;
            },
            message: "Selecciona una opción de apariencia física",
          },
        },
        // STEP 6: AVATAR IMAGE SELECTION
        {
          id: "agent-avatar",
          title: "Selecciona la Foto de Cara",
          description: "Esta es la imagen que se usará como foto de perfil de tu compañero AI. Puedes subir tu propia imagen, dejar que el sistema genere una automáticamente, o elegir una de las opciones disponibles.\n\nSigue las instrucciones en pantalla para seleccionar o subir una imagen.",
          targets: ['[data-tour="avatar-selector"]'],
          position: "left",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, selecciona o sube una foto de cara para tu compañero AI.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que haya avanzado al paso de reference image
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "reference image" or "full body" has already been mentioned, it means that avatar was completed
                return messages.toLowerCase().includes('imagen de referencia') ||
                       messages.toLowerCase().includes('cuerpo completo') ||
                       messages.toLowerCase().includes('imagen de cuerpo');
              }
              return false;
            },
            message: "Selecciona o sube una foto de cara",
          },
        },
        // STEP 7: REFERENCE IMAGE SELECTION
        {
          id: "agent-reference-image",
          title: "Selecciona la Imagen de Referencia",
          description: "Esta imagen de cuerpo completo se usará como referencia para generar imágenes futuras de tu compañero AI. Es opcional pero mejora significativamente la calidad de las imágenes generadas.\n\nPuedes subir una imagen, dejar que el sistema la genere, o saltarla si prefieres.",
          targets: ['[data-tour="reference-image-selector"]'],
          position: "left",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, selecciona, sube o salta la imagen de referencia.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que haya avanzado al paso de nsfw mode
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "nsfw" or "adult content" has already been mentioned, it means that reference image was completed
                return messages.toLowerCase().includes('nsfw') ||
                       messages.toLowerCase().includes('contenido adulto') ||
                       messages.toLowerCase().includes('contenido explícito');
              }
              return false;
            },
            message: "Selecciona, sube o salta la imagen de referencia",
          },
        },
        // STEP 8: NSFW MODE SELECTION
        {
          id: "agent-nsfw-mode",
          title: "Configura el Modo NSFW",
          description: "El modo NSFW (Not Safe For Work) permite que tu compañero AI pueda generar contenido adulto o explícito si lo solicitas. Si lo desactivas, el AI evitará este tipo de contenido.\n\n**Sí:** Permite contenido adulto cuando sea apropiado\n**No:** Mantiene todas las interacciones seguras para el trabajo\n\nHaz clic en la opción que prefieras abajo.",
          targets: ['[data-tour="option-selector"]'],
          position: "top",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, selecciona si deseas activar el modo NSFW.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que haya avanzado al paso de allow develop traumas
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "traumas" or "emotional development" has already been mentioned, it means that nsfw mode was completed
                return messages.toLowerCase().includes('trauma') ||
                       messages.toLowerCase().includes('desarrollo emocional') ||
                       messages.toLowerCase().includes('desarrollar');
              }
              return false;
            },
            message: "Selecciona una opción para el modo NSFW",
          },
        },
        // STEP 9: ALLOW DEVELOP TRAUMAS
        {
          id: "agent-allow-traumas",
          title: "Permitir Desarrollo de Traumas",
          description: "Esta opción permite que tu compañero AI desarrolle traumas o patrones emocionales complejos basados en tus interacciones. Esto hace que la experiencia sea más realista y profunda, pero puede resultar en comportamientos emocionales intensos.\n\n**Sí:** El AI puede desarrollar patrones emocionales complejos\n**No:** El AI mantiene una estabilidad emocional constante\n\nHaz clic en la opción que prefieras abajo.",
          targets: ['[data-tour="option-selector"]'],
          position: "top",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, selecciona si deseas permitir el desarrollo de traumas.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que haya avanzado al paso de initial behavior
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                // If "initial behavior" or "patterns" has already been mentioned, it means that allow traumas was completed
                return messages.toLowerCase().includes('comportamiento inicial') ||
                       messages.toLowerCase().includes('patrón inicial') ||
                       messages.toLowerCase().includes('initial behavior');
              }
              return false;
            },
            message: "Selecciona una opción para el desarrollo de traumas",
          },
        },
        // STEP 10: INITIAL BEHAVIOR SELECTION
        {
          id: "agent-initial-behavior",
          title: "Selecciona el Comportamiento Inicial",
          description: "Finalmente, puedes elegir un comportamiento inicial para tu compañero AI. Esto define patrones emocionales o de apego desde el inicio:\n\n**Ninguno:** Sin comportamiento especial\n**Apego ansioso:** Necesita validación constante\n**Apego evitativo:** Mantiene distancia emocional\n**Codependencia:** Busca dependencia emocional\n**Yandere/Obsesivo:** Muestra obsesión protectora\n**Borderline:** Emociones intensas y cambiantes\n**Aleatorio secreto:** El sistema elige uno sorpresa\n\nHaz clic en la opción que prefieras abajo.",
          targets: ['[data-tour="option-selector"]'],
          position: "top",
          requiredPage: "/constructor",
          interactive: true,
          requiresCompletion: true,
          waitMessage: "Por favor, selecciona un comportamiento inicial para tu compañero AI.",
          validation: {
            type: "custom",
            customCheck: () => {
              // Verificar que el agente haya sido creado
              // This is indicated by the appearance of the "Go to chat" button or a success message
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                const messages = messagesContainer.textContent || '';
                return messages.toLowerCase().includes('¡perfecto!') ||
                       messages.toLowerCase().includes('creado exitosamente') ||
                       messages.toLowerCase().includes('ir al chat') ||
                       messages.toLowerCase().includes('completado');
              }
              // Also check if there's a "Go to chat" button visible
              const goToChatButton = document.querySelector('[href^="/agentes/"]');
              return !!goToChatButton;
            },
            message: "Selecciona un comportamiento inicial",
          },
        },
      ],
    },
    {
      id: "community-interaction",
      name: t("communityInteraction.name"),
      description: t("communityInteraction.description"),
      requiredForCompletion: true,
      startPage: "/community",
      allowPageChange: true,
      steps: [
        {
          id: "community-intro",
          title: t("communityInteraction.steps.intro.title"),
          description: t("communityInteraction.steps.intro.description"),
          position: "bottom",
          requiredPage: "/community",
        },
        {
          id: "community-create-post",
          title: t("communityInteraction.steps.createPost.title"),
          description: t("communityInteraction.steps.createPost.description"),
          target: '[data-tour="create-post-button"]',
          position: "left",
          requiredPage: "/community",
          interactive: true,
          requiresCompletion: true,
          waitMessage: t("communityInteraction.steps.createPost.waitMessage"),
          validation: {
            type: "custom",
            customCheck: async () => {
              // Verificar si el usuario ha creado un post recientemente
              // Podemos detectar esto de varias formas:
              // 1. Check if there is a parameter in the URL indicating a return from creating a post
              // 2. Verificar el localStorage
              // 3. Hacer una llamada a la API para ver si hay posts nuevos

              // Por simplicidad, usaremos localStorage
              const hasCreatedPost = localStorage.getItem('tour_post_created') === 'true';

              // We also accept if the user is on the create post page or has just returned
              const _isOnCreatePage = window.location.pathname.includes('/community/create');
              const justReturned = sessionStorage.getItem('returned_from_create') === 'true';

              if (justReturned) {
                sessionStorage.removeItem('returned_from_create');
                localStorage.setItem('tour_post_created', 'true');
                return true;
              }

              return hasCreatedPost;
            },
            message: t("communityInteraction.steps.createPost.validationMessage"),
          },
          action: {
            label: t("communityInteraction.steps.createPost.actionLabel"),
            href: "/community/create",
          },
        },
        {
          id: "community-filters",
          title: t("communityInteraction.steps.filters.title"),
          description: t("communityInteraction.steps.filters.description"),
          target: '[data-tour="feed-filters"]',
          position: "bottom",
          requiredPage: "/community",
          interactive: true,
        },
        {
          id: "community-post-types",
          title: t("communityInteraction.steps.postTypes.title"),
          description: t("communityInteraction.steps.postTypes.description"),
          target: '[data-tour="post-type-filters"]',
          position: "bottom",
          requiredPage: "/community",
          interactive: true,
        },
        {
          id: "community-interact",
          title: t("communityInteraction.steps.interact.title"),
          description: t("communityInteraction.steps.interact.description"),
          target: '[data-tour="post-card"]',
          position: "top",
          requiredPage: "/community",
        },
        {
          id: "community-sidebar",
          title: t("communityInteraction.steps.sidebar.title"),
          description: t("communityInteraction.steps.sidebar.description"),
          target: '[data-tour="popular-communities"]',
          position: "left",
          requiredPage: "/community",
        },
      ],
    },
    {
      id: "community-tour",
      name: t("communityTour.name"),
      description: t("communityTour.description"),
      steps: [
        {
          id: "community-intro",
          title: t("communityTour.steps.intro.title"),
          description: t("communityTour.steps.intro.description"),
          target: '[data-tour="community-link"]',
          position: "right",
        },
        {
          id: "community-posts",
          title: t("communityTour.steps.posts.title"),
          description: t("communityTour.steps.posts.description"),
          position: "bottom",
        },
        {
          id: "community-events",
          title: t("communityTour.steps.events.title"),
          description: t("communityTour.steps.events.description"),
          position: "bottom",
        },
        {
          id: "community-marketplace",
          title: t("communityTour.steps.marketplace.title"),
          description: t("communityTour.steps.marketplace.description"),
          position: "bottom",
        },
      ],
    },
    {
      id: "worlds-intro",
      name: t("worldsIntro.name"),
      description: t("worldsIntro.description"),
      steps: [
        {
          id: "worlds-concept",
          title: t("worldsIntro.steps.concept.title"),
          description: t("worldsIntro.steps.concept.description"),
          target: '[data-tour="worlds-link"]',
          position: "right",
        },
        {
          id: "worlds-create",
          title: t("worldsIntro.steps.create.title"),
          description: t("worldsIntro.steps.create.description"),
          target: '[data-tour="create-world-button"]',
          position: "bottom",
        },
        {
          id: "worlds-dynamics",
          title: t("worldsIntro.steps.dynamics.title"),
          description: t("worldsIntro.steps.dynamics.description"),
          position: "bottom",
        },
        {
          id: "worlds-scenarios",
          title: t("worldsIntro.steps.scenarios.title"),
          description: t("worldsIntro.steps.scenarios.description"),
          position: "bottom",
        },
      ],
    },
    {
      id: "plans-and-features",
      name: t("plansAndFeatures.name"),
      description: t("plansAndFeatures.description"),
      steps: [
        {
          id: "my-stats",
          title: t("plansAndFeatures.steps.myStats.title"),
          description: t("plansAndFeatures.steps.myStats.description"),
          target: '[data-tour="my-stats-link"]',
          position: "right",
        },
        {
          id: "plans-overview",
          title: t("plansAndFeatures.steps.plansOverview.title"),
          description: t("plansAndFeatures.steps.plansOverview.description"),
          target: '[data-tour="billing-link"]',
          position: "right",
        },
        {
          id: "upgrade-benefits",
          title: t("plansAndFeatures.steps.upgradeBenefits.title"),
          description: t("plansAndFeatures.steps.upgradeBenefits.description"),
          position: "bottom",
        },
        {
          id: "manage-subscription",
          title: t("plansAndFeatures.steps.manageSubscription.title"),
          description: t("plansAndFeatures.steps.manageSubscription.description"),
          position: "bottom",
        },
      ],
    },
  ];
}

/**
 * Obtiene un tour por su ID
 * NOTA: Usar solo dentro de componentes que usen useOnboardingTours()
 */
export function getTourById(tours: OnboardingTour[], tourId: string): OnboardingTour | undefined {
  return tours.find((tour) => tour.id === tourId);
}

/**
 * Gets the next tour after the current one
 * NOTE: Use only inside components that use useOnboardingTours()
 */
export function getNextTour(tours: OnboardingTour[], currentTourId: string): OnboardingTour | undefined {
  const currentIndex = tours.findIndex((tour) => tour.id === currentTourId);
  if (currentIndex === -1 || currentIndex === tours.length - 1) {
    return undefined;
  }
  return tours[currentIndex + 1];
}

/**
 * Obtiene solo los tours marcados como requeridos
 * NOTA: Usar solo dentro de componentes que usen useOnboardingTours()
 */
export function getRequiredTours(tours: OnboardingTour[]): OnboardingTour[] {
  return tours.filter((tour) => tour.requiredForCompletion);
}

/**
 * Static list of tour IDs (for use in contexts without translations)
 * Useful for verifying IDs without needing to load translations
 */
export const TOUR_IDS = [
  "welcome",
  "first-agent",
  "community-interaction",
  "community-tour",
  "worlds-intro",
  "plans-and-features",
] as const;

export type TourId = typeof TOUR_IDS[number];

import { useCallback } from 'react'
import Joyride, { STATUS, EVENTS } from 'react-joyride'

const STEPS = [
  {
    target: '[data-tour="calendar-import"]',
    title: '📥 Importer vos contrats',
    content:
      "Chargez vos contrats existants (CSV/ICS) pour peupler votre calendrier en un clic. Idéal pour reprendre là où vous étiez.",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="calendar-add-mission"]',
    title: '➕ Ajouter une mission manuelle',
    content:
      "Bloquez une plage de temps pour une mission hors plateforme (ménage privé, entretien récurrent). Elle apparaîtra dans votre calendrier sans passer par une demande.",
    placement: 'bottom',
  },
  {
    target: '[data-tour="calendar-conflicts"]',
    title: '⚠️ Vue conflits',
    content:
      "Les jours en jaune signalent qu'une demande ouverte chevauche une mission confirmée. Cliquez le jour pour voir le détail et éviter les doubles bookings.",
    placement: 'top',
  },
  {
    target: '[data-tour="calendar-filters"]',
    title: '🔍 Filtres',
    content:
      "Affichez uniquement ce qui compte : missions confirmées, demandes ouvertes, ou les deux. Les filtres s'appliquent à la vue mensuelle et hebdomadaire.",
    placement: 'bottom-end',
  },
]

const LOCALE = {
  back: 'Précédent',
  close: 'Fermer',
  last: 'Terminer',
  next: 'Suivant',
  open: 'Ouvrir le tutoriel',
  skip: 'Passer',
}

const STYLES = {
  options: {
    primaryColor: '#0d9488',
    textColor: '#1f2937',
    backgroundColor: '#ffffff',
    arrowColor: '#ffffff',
    overlayColor: 'rgba(15, 23, 42, 0.55)',
    zIndex: 10000,
  },
  tooltip: { borderRadius: 16, padding: 16 },
  tooltipTitle: { fontSize: 15, fontWeight: 800, marginBottom: 6 },
  tooltipContent: { fontSize: 13, lineHeight: 1.5 },
  buttonNext: { borderRadius: 10, padding: '8px 14px', fontWeight: 700 },
  buttonBack: { color: '#6b7280', marginRight: 8 },
  buttonSkip: { color: '#9ca3af' },
}

export default function CalendarTour({ run, onFinish }) {
  const handleCallback = useCallback(
    (data) => {
      const { status, type } = data
      const done = [STATUS.FINISHED, STATUS.SKIPPED].includes(status)
      const closed = type === EVENTS.TOUR_END
      if (done || closed) {
        onFinish?.(status)
      }
    },
    [onFinish]
  )

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      spotlightPadding={6}
      locale={LOCALE}
      styles={STYLES}
      callback={handleCallback}
    />
  )
}

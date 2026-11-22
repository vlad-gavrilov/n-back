import { useState } from 'react'
import type { Messages } from '../i18n'

function ExampleSequence({ t }: { t: Messages }) {
  return (
    <div className="example-sequence" aria-label={t.example}>
      {[0, 8, 0].map((position, step) => (
        <div key={step}>
          <div className="example-field">
            {Array.from({ length: 9 }, (_, cell) => <i key={cell} className={cell === position ? 'on' : ''} />)}
          </div>
          <small>{step === 2 ? `${t.match} ↶` : t.exampleStep(step + 1)}</small>
        </div>
      ))}
    </div>
  )
}

interface TutorialProps {
  trialMs: number
  onClose: () => void
  t: Messages
}

export function Tutorial({ trialMs, onClose, t }: TutorialProps) {
  const [step, setStep] = useState(0)
  const lessons = [
    { title: t.lessonTitle0, text: t.lessonText0 },
    { title: t.lessonTitle1, text: t.lessonText1 },
    { title: t.lessonTitle2, text: t.lessonText2(trialMs) },
  ]
  const last = step === lessons.length - 1

  return (
    <div className="lesson">
      <p className="mode-label">{t.lessonStep(step + 1)}</p>
      <h3>{lessons[step].title}</h3>
      <p>{lessons[step].text}</p>
      {step === 0 && <ExampleSequence t={t} />}
      <button className="primary-button" onClick={last ? onClose : () => setStep(step + 1)}>
        {last ? t.ready : t.next}<span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}

const researchPapers = [
  { author: 'Jaeggi', year: 2008, title: 'jaeggi', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2383929/' },
  { author: 'Soveri', year: 2017, title: 'soveri', href: 'https://pubmed.ncbi.nlm.nih.gov/28116702/' },
  { author: 'Li', year: 2026, title: 'li', href: 'https://www.nature.com/articles/s41746-026-02478-9' },
] as const

export function Research({ t }: { t: Messages }) {
  return (
    <div className="research-links">
      <p>{t.researchIntro}</p>
      {researchPapers.map(paper => (
        <a key={paper.href} href={paper.href} target="_blank" rel="noreferrer">
          {t.authors(paper.author, paper.year)}<span>{t[paper.title]}</span>
        </a>
      ))}
    </div>
  )
}

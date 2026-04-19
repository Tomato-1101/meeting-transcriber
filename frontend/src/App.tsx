import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { TranscriptionPage } from './pages/TranscriptionPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <a href="/" className="text-xl font-bold text-gray-900 no-underline">
              Meeting Transcriber
            </a>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/transcription/:id" element={<TranscriptionPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

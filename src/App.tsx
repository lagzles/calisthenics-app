import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HistoryPage } from './pages/History/HistoryPage'
import { HomePage } from './pages/Home/HomePage'
import { NotFoundPage } from './pages/NotFound/NotFoundPage'
import { CustomWorkoutEditorPage } from './pages/Workouts/CustomWorkoutEditorPage'
import { WorkoutDetailsPage } from './pages/Workouts/WorkoutDetailsPage'
import { WorkoutsPage } from './pages/Workouts/WorkoutsPage'
import { WorkoutModePage } from './pages/WorkoutMode/WorkoutModePage'

/**
 * HashRouter garante navegação compatível com hospedagem estática
 * (GitHub Pages) e com o funcionamento offline do PWA.
 *
 * A rota `/treino/:workoutId` (Workout Mode) fica **fora** do `AppLayout`: a
 * execução do treino não exibe a navegação principal.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="treino/:workoutId" element={<WorkoutModePage />} />
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="treinos" element={<WorkoutsPage />} />
          <Route path="treinos/personalizados/novo" element={<CustomWorkoutEditorPage />} />
          <Route path="treinos/personalizados/:id/editar" element={<CustomWorkoutEditorPage />} />
          <Route path="treinos/:workoutId" element={<WorkoutDetailsPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

import { createHashRouter, RouterProvider } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Review from './pages/Review';
import Settings from './pages/Settings';
import Words from './pages/Words';

// Hash routes keep deep links working on any static host without rewrites.
const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/ler/:bookId', element: <Reader /> },
  { path: '/revisar', element: <Review /> },
  { path: '/palavras', element: <Words /> },
  { path: '/ajustes', element: <Settings /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

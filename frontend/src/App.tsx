import { useState } from 'react';
import LoginPage, { MOCK_USERS } from './features/auth/LoginPage';
import DashboardPage from './components/DashboardPage';

type User = (typeof MOCK_USERS)[0];

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return <DashboardPage user={currentUser} onLogout={() => setCurrentUser(null)} />;
}

export default App;

import './App.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import logo from './logo.svg'
import LandingPage from "./pages/landing";

function App(){
  return (
    <>
    <Router>
      <Routes>
        {/* <Route path = '/home' element= /> */}

        <Route path = '/' element = {<LandingPage/>}/>
      </Routes>
    </Router>
    </>
  )
}

export default App;
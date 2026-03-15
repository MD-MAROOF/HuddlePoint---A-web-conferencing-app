import React from 'react'
import '../App.css';
import { Link } from 'react-router-dom';

export default function landing() {
    return (
        <div className='landingPageContainer'>
            <nav>
                <div className='navHeader'>
                    <h2> HuddlePoint</h2>
                </div>

                <div className='navlist'>
                    <p> Join as Guest</p>
                    <p> Register</p>
                    <div role='button'>
                        <p>Login</p>
                    </div>
                </div>
            </nav>

            <div className='landingMainContainer'>
                <div>
                    <h1><span style={{ color: "#FF9839" }}>Connect </span>with anyone, anywhere</h1>

                    <p>Cover a distance by HuddlePoint</p>
                    <div role='button'>
                        <Link to={"/home"}> Get Started</Link>
                    </div>
                </div>

                <div>
                    <img src="/mobile.png"/>
                </div>
            </div>
        </div>
    
    )
}
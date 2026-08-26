(function() {
    function getHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    }

    function getColors(str) {
        const hash = getHash(str);
        const h = hash % 360;
        return {
            main: `hsl(${h}, 75%, 55%)`,
            hover: `hsl(${h}, 75%, 45%)`,
            gradient: `linear-gradient(to right, hsl(${h}, 75%, 60%), hsl(${(h + 40) % 360}, 75%, 50%))`
        };
    }

    // Determine if we are on a tool page based on pathname
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const isToolPage = pathSegments.length > 0 && pathSegments[0] !== 'index.html';
    
    if (isToolPage) {
        const toolName = pathSegments[0];
        const colors = getColors(toolName);
        document.documentElement.style.setProperty('--primary', colors.main);
        document.documentElement.style.setProperty('--primary-hover', colors.hover);
        
        // Ensure h1 gradient also matches
        document.documentElement.style.setProperty('--title-gradient', colors.gradient);
    }

    window.addEventListener('DOMContentLoaded', () => {
        const toolCards = document.querySelectorAll('.tool-card');
        toolCards.forEach(card => {
            const href = card.getAttribute('href');
            if (href) {
                const folderName = href.replace(/\//g, '');
                const colors = getColors(folderName);
                card.style.setProperty('--card-gradient', colors.gradient);
            }
        });
        
        // Tool page h1 title gradient
        if (isToolPage) {
            const h1 = document.querySelector('h1');
            if (h1) {
                h1.style.background = 'var(--title-gradient)';
                h1.style.webkitBackgroundClip = 'text';
                h1.style.webkitTextFillColor = 'transparent';
            }
        }
    });
})();
const popup = document.getElementById('popup');
const closeButtons = document.querySelectorAll('.close-btn');

closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        popup.style.display = 'none';
    });
});

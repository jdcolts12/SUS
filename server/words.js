// Word categories for the Imposter game
// Each category has a list of words - one word is picked per round
export const wordCategories = {
  "Famous People": [
    "Taylor Swift", "Beyoncé", "Tom Hanks", "Dwayne Johnson", "Rihanna",
    "Leonardo DiCaprio", "Oprah", "Adele", "Brad Pitt", "Drake",
    "Serena Williams", "Meryl Streep", "Emma Watson", "LeBron James", "Lady Gaga",
    "Kim Kardashian", "Cristiano Ronaldo", "Kanye West", "The Rock", "Elon Musk"
  ],
  "Food & Drinks": [
    "pizza", "coffee", "sushi", "tacos", "avocado toast", "kombucha",
    "croissant", "dim sum", "pho", "matcha", "craft beer", "charcuterie",
    "tiramisu", "smoothie bowl", "ramen", "gelato", "hummus", "ceviche",
    "boba tea", "acai bowl"
  ],
  "Movies & TV Shows": [
    "Stranger Things", "Titanic", "The Office", "Marvel", "Star Wars",
    "Friends", "Harry Potter", "Squid Game", "Breaking Bad", "Game of Thrones",
    "Jurassic Park", "The Lion King", "Bridgerton", "Inception", "Wednesday",
    "Ted Lasso", "Barbie", "Top Gun", "The Crown", "Bridesmaids"
  ],
  "Athletes / Sports Figures": [
    "Michael Jordan", "Serena Williams", "Tom Brady", "Usain Bolt", "Simone Biles",
    "LeBron James", "Tiger Woods", "Muhammad Ali", "Messi", "Cristiano Ronaldo",
    "Naomi Osaka", "Shaquille O'Neal", "Steph Curry", "Venus Williams", "Michael Phelps",
    "Kobe Bryant", "Roger Federer", "David Beckham", "Wayne Gretzky", "Peyton Manning"
  ],
  "Places / Cities": [
    "New York", "Paris", "Tokyo", "Dubai", "Rome",
    "London", "Barcelona", "Amsterdam", "Miami", "Las Vegas",
    "Sydney", "Venice", "Santorini", "Bali", "Los Angeles",
    "Chicago", "San Francisco", "Nashville", "Austin", "New Orleans"
  ],
  "Brands & Companies": [
    "Apple", "Nike", "Netflix", "Starbucks", "Amazon",
    "Disney", "Tesla", "Spotify", "McDonald's", "Google",
    "Adidas", "Coca-Cola", "Target", "IKEA", "Uber",
    "Airbnb", "YouTube", "Instagram", "Samsung", "Sony"
  ],
  "Animals": [
    "elephant", "penguin", "dolphin", "butterfly", "kangaroo",
    "octopus", "flamingo", "hedgehog", "chameleon", "giraffe",
    "sloth", "koala", "panda", "tiger", "peacock",
    "hummingbird", "platypus", "meerkat", "llama", "owl"
  ],
  "Occupations / Jobs": [
    "teacher", "astronaut", "chef", "pilot", "photographer",
    "veterinarian", "architect", "journalist", "firefighter", "nurse",
    "lawyer", "barista", "DJ", "personal trainer", "real estate agent",
    "software engineer", "hairstylist", "electrician", "plumber", "social worker"
  ],
  "Fictional Characters": [
    "Spider-Man", "Elsa", "Harry Potter", "Homer Simpson", "Mario",
    "Wonder Woman", "Sherlock Holmes", "Batman", "Darth Vader", "Hermione Granger",
    "Iron Man", "Mickey Mouse", "Cinderella", "Thor", "Walter White",
    "Eleven", "Barbie", "Woody", "Shrek", "The Joker"
  ],
  "Everyday Objects": [
    "umbrella", "headphones", "water bottle", "charging cable", "keys",
    "scissors", "tape", "stapler", "paper clips", "coaster",
    "nail clippers", "lint roller", "hair dryer", "toothbrush", "alarm clock",
    "remote control", "wallet", "can opener", "corkscrew", "candle"
  ]
};

export const categoryNames = Object.keys(wordCategories);

// one change is that we do not use files for reading the words anymore, for simplicity
// the resources are defined in TypeScript modules
// sometimes typescript fails to process these two modules, but they work fine in javascript
import { allwords } from './allwords';
import { answers } from './answers';
// the functionality needed from the previous application
import {
  Letter,
  LetterGuess,
  Wordle,
  rateGuesses,
  bestGuesses,
  fillGuesses,
  isValidGuess,
  isValidPrefix,
  randomWord,
  status,
  stringToWord,
} from './wordle';
// we need the useState hook
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
// some basic components
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  Button,
  Switch,
  TextInput,
  Share,
} from 'react-native';
import Constants from 'expo-constants';
import { Card } from 'react-native-paper';
import * as Haptics from 'expo-haptics';

// some type definitions for callbacks
type StrCallback = (arg: string) => void;
type Callback = () => void;
type WordleCallback = (arg: Wordle) => void;

let share: string|null = null

const background = (g: LetterGuess) => {
  switch (g.kind) {
    case 'correct':
      return styles.correct;
    case 'absent':
      return styles.absent;
    case 'misplaced':
      return styles.misplaced;
    default:
      return styles.untried;
  }
};

// this component renders a single letter on the board, including its color
// we use the helper function above, to find the right color for each guess
const BoardLetter = ({ guess }: { guess: LetterGuess }) => {
  return (
    <View style={[styles.boardCell, background(guess)]}>
      <Text style={styles.keyText}>{guess.letter.character}</Text>
    </View>
  );
};

//TODO Sharing (1 pts)
function appendGuess(guess: LetterGuess): string {
  let tmp = share;
  let append: string;
  switch (guess.kind) {
    case 'correct': {
      append = '🟩';
      break;
    }
    case 'misplaced': {
      append = '🟨';
      break;
    }
    default:
      append = '⬜';
  }
  return tmp + append;
}

// a row of the board is just rendering all the letters as a row of components
const BoardRow = ({ letters }: { letters: LetterGuess[] }) => {
  return (
    <View style={styles.row}>
      {letters.map((l) => (
        <BoardLetter guess={l} />
      ))}
    </View>
  );
};


// the board is made of rows of letters
const Board = ({
  game,
  guess,
  valid,
}: {
  game: Wordle;
  guess: string;
  valid: boolean;
}) => {
  // we compute the colors of each submitted guess, using the function from assignment 1
  const guesses: LetterGuess[][] = game.guesses.map((guess: string) =>
    rateGuesses(guess, game.answer)
  );

  // here we compute the colors of the letters of the guess that is being typed
  // either a gray background if it's valid, or a red background if we know it's invalid
  // we "pad" the guess with spaces so that it's of length five
  // we produce LetterGuess data structures of type "untried" (gray) or "absent" (red)
  // depending on the validity of the guess
  //TODO Haptics (1 pts)
  const filled: LetterGuess[] = [
    ...guess,
    ...new Array(game.answer.length - guess.length).fill(' '),
  ].map((char, idx) => ({
    letter: { character: char, index: idx },
    kind: valid ? 'untried' : 'absent',
  }));
  if (!valid) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  // next, we compute the rows that are still empty
  // they all have as a letter a space, and they are "untried" to be colored in gray
  const empties = fillGuesses(
    [],
    game.maxGuesses - game.guesses.length - 1
  ).map((guess: string) =>
    stringToWord(guess).map((l: Letter) => ({ letter: l, kind: 'untried' }))
  );

  // finally, we combine all these lists together, so that we have a full board of 6 rows
  // one special case, which is when we have reached the maximum number of attemps, in that
  // case we just take the guesses
  const allGuesses: LetterGuess[][] =
    guesses.length >= game.maxGuesses
      ? guesses
      : [...guesses, filled, ...empties];

      if(guesses.length>=game.maxGuesses){
        share = `Answer: ${game.answer}\nAttempts: ${game.maxGuesses}\n\n`
        allGuesses.map((guess)=>{
          guess.map((letter)=>{
            share = appendGuess(letter)
          })
          share+="\n"
        })
      }

  // we render the entire board, as multiple rows
  return (
    <View>
      {allGuesses.map((g) => (
        <BoardRow letters={g} />
      ))}
    </View>
  );
};

// each key renders a single letter, and has a callback to indicate that it was pressed
const Key = ({
  guess,
  onPress,
}: {
  guess: LetterGuess;
  onPress: StrCallback;
}) => (
  <Pressable
    style={[styles.key, background(guess)]}
    onPress={() => onPress(guess.letter.character)}>
    <Text style={styles.keyText}>{guess.letter.character}</Text>
  </Pressable>
);

// a component for the keyboard, that renders all the keys, and the enter and delete buttons
// similar to the board, we need to figure out the background of each key,
// and also pass it a callback
// we also need the props that tell us which buttons are enabled or disable,
// and the callbacks to tell us what to do when a button is pressed
const KeyBoard = ({
  game,
  valid,
  empty,
  onPress,
  onEnter,
  onDelete,
}: {
  game: Wordle;
  valid: boolean;
  empty: boolean;
  onPress: StrCallback;
  onEnter: Callback;
  onDelete: Callback;
}) => {
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  // we get the color for each key (defined as the kind of guess)
  const coloredRows = rows.map((r) =>
    bestGuesses(r, game.guesses, game.answer)
  );
  const toKey = (guess: LetterGuess) => <Key guess={guess} onPress={onPress} />;
  const toKeys = (row: LetterGuess[]) => (
    <View style={styles.row}>{row.map((g) => toKey(g))}</View>
  );

  return (
    <View>
      {coloredRows.map((row) => toKeys(row))}
      <View style={[styles.row, styles.centered]}>
        <Button title="enter" onPress={onEnter} disabled={!valid} />
        <Button title="delete" onPress={onDelete} disabled={empty} />
      </View>
    </View>
  );
};

// a bar that is used to show statistics
// to render we use a foreground view, with the right color
// we use an empty view to make up the space
// we use the flexbox layout with the value used as a percentage to set the size of the views
const Bar = ({
  title,
  percent,
  color,
}: {
  title: string;
  percent: number;
  color: 'red' | 'green';
}) => (
  <View style={[styles.row, { height: 20 }]}>
    <Text style={{ flex: 20 }}>{title}</Text>
    <View
      style={[styles.bordered, { backgroundColor: color, flex: percent }]}
    />
    <View style={{ flex: 100 - percent }} />
  </View>
);

// shows a basic histogram of the game statistics
// takes a list of numbers (the number of attempts of each game)
// we compute the percentages of each category
// we render a bar of a histogram based on the percentages
const Statistics = ({ stats }: { stats: number[] }) => {
  const buckets = [1, 2, 3, 4, 5, 6, 7].map((num) =>
    stats.filter((s) => s === num)
  );
  const max = stats.length === 0 ? 1 : stats.length;
  const percents = buckets.map((b) => Math.floor(100 * (b.length / max)));

  return (
    <View>
      {percents.map((p, idx) => {
        const lost = idx === buckets.length - 1;
        return (
          <Bar
            title={lost ? 'lost' : idx + 1 + ' tries'}
            percent={p}
            color={lost ? 'red' : 'green'}
          />
        );
      })}
    </View>
  );
};

// The settings screen, with extensive input validation of the textfields
// and it also shows the statistics, and allows to start a game
const Settings = ({
  onStart,
  statistics,
}: {
  onStart: WordleCallback;
  statistics: number[];
}) => {
  // whether we are in hard more or not
  const [hard, setHard] = useState<boolean>(false);
  // the index of the word to be selected
  const [num, setNum] = useState<string>('');
  // the word to be selected, or "Random" if we choose randomly
  const [word, setWord] = useState<string>('Random');

  // whenewer a new character is entered in the text field
  // we parse it, and find the corresponding word
  const validateNum = (input: string) => {
    const theNum = parseInt(input);
    const theWord = answers[theNum];

    if (theWord !== undefined) {
      setNum(input);
      setWord(theWord);
    }
    if (input === '') {
      setNum('');
      setWord('Random');
    }
  };

  // whenever a character is entered in this text field
  // we look for the prefix, find the right index to update the second text field
  const validateWord = (input: string) => {
    const findPrefixIndex = (prefix: string, words: string[]): number =>
      words.findIndex((w) => w.startsWith(prefix));
    const index = findPrefixIndex(input, answers);
    if (index > -1) {
      setNum('' + index);
      setWord(input);
    }
  };

  share = null;

  const startGame = () => {
    Haptics.selectionAsync();
    const answer =
      word === 'Random' ? randomWord(answers) : answers[parseInt(num)];
    onStart({
      guesses: [],
      answer: answer,
      words: answers,
      validwords: allwords,
      maxGuesses: 6,
      mode: hard ? 'hard' : 'easy',
      statistics: statistics,
    });
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.paragraph}>Wordle Settings</Text>
        <View style={[styles.row, styles.centered]}>
          <View>
            <Text>Hard Mode: </Text>
            <Text>Word: </Text>
            <Text>Number (0–{answers.length - 1}):</Text>
          </View>
          <View>
            <Switch value={hard} onValueChange={setHard} />
            <TextInput
              style={[styles.textField, styles.bordered]}
              autoCapitalize={'characters'}
              value={word}
              onChangeText={validateWord}
            />
            <TextInput
              style={[styles.textField, styles.bordered]}
              value={num}
              keyboardType="numeric"
              onChangeText={validateNum}
            />
          </View>
        </View>
        <Button title="Start" onPress={startGame} />
      </Card>
      <Card style={styles.card}>
        <Text style={styles.paragraph}>Statistics</Text>
        <Statistics stats={statistics} />
        <Button
          title="Reset Statistics"
          onPress={() => {
            statistics = [];
            setData([]);
          }}
        />
      </Card>
    </View>
  );
};
// the wordle game screen with the high level logic
const WordleGame = ({
  startGame,
  onBack,
}: {
  startGame: Wordle;
  onBack: WordleCallback;
}) => {
  // this state keeps track of what the user typed when entering a guess
  const [guess, setGuess] = useState<string>('');
  // we keep the game in the state, as it will be changing
  const [game, setGame] = useState<Wordle>(startGame);

  // this variable (not a state) keeps track of whether the guess is a valid prefix
  const prefixValid = isValidPrefix(guess, game.validwords);
  // this variable keeps track of whether the guess is valid
  const enterValid = isValidGuess(guess, game);

  // this is a callback for the keys:
  // whenever a key is pressed we add one letter to the guess
  const keyPress = (char: string) => setGuess(guess + char);
  // this is a callback for the delete key:
  // we remove the last letter from the guess
  const backspace = () => setGuess(guess.slice(0, -1));

  // this is a callback to submit a guess
  // called when the enter key is pressed
  // we add the guess to the list of guesses
  // this will cause the component to re-render
  // we also reset the guess that is being typed
  const addGuess = () => {
    setGame({ ...game, guesses: [...game.guesses, guess] });
    setGuess('');
  };
//TODO Dictionary API integration (mandatory, 2pt)
  const link: string =
    'https://api.dictionaryapi.dev/api/v2/entries/en/' +
    game.answer.toLowerCase();

  const [hint, setHint] = useState<string|null>(null);
  const [definition, setDefinition] = useState<string|null>(null);

  fetch(link, {
    //Request Type
    method: 'GET',
  })
      //If response is in json then in success
    .then((response) => {
      response.json().then(responseJson => {
        //Success
        if(typeof responseJson!== 'undefined'){
          setHint(responseJson[0].meanings[0].partOfSpeech);
          setDefinition(responseJson[0].meanings[0].definitions[0].definition);
          console.log("Hint and Definition fetched.")
        }
      })
    })
    //If response is not in json then in error
    .catch((error) => {
      //Error
      console.error(error);
    });

  // we compute the message that we should display to the user
  // if the game is not finished, no message
  // there's only a message if we win or lose
  const message = () => {
    // we determine that using the status function from assignment 1
    switch (status(game)) {
      case 'win': {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return 'You won! Congratulations :-)\n\n' + definition;
      }
      case 'lost': {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return (
          'Sorry, you lost :-( \n the word was: ' +
          game.answer +
          '\n\n' +
          definition
        );
      }
      case 'next':
        return '';
    }
  };

  const [showDefinition, showDefinitionClick] = useState<boolean>(false);
  const [showHint, showHintClick] = useState<boolean>(false);

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>Wordle</Text>
      <Text style={styles.paragraph}>{message()}</Text>
      <Card style={styles.card}>
        <Board
          game={game}
          guess={guess}
          valid={guess.length === 5 ? enterValid : prefixValid}
        />
      </Card>
      {showDefinition || showHint ? (
        <Card style={styles.card}>
          {hint!== null && definition!== null?
            <View>
              {showHint ? <Text>The word is a {hint}</Text> : <Text />}
              {showDefinition ? <Text> Definition: {definition}</Text> : <Text />}
            </View>:
            <Text>Hint and Definition fetching in progress...</Text>
          }
        </Card>
      ) : (
        <Text />
      )}

      <Card style={styles.card}>
        <KeyBoard
          game={game}
          valid={enterValid}
          empty={guess === ''}
          onPress={keyPress}
          onDelete={backspace}
          onEnter={addGuess}
        />
        <View style={styles.buttons}>
          <Button
            title="Desperate Hint"
            disabled={game.guesses.length < 5 && !showDefinition}
            onPress={() => showDefinitionClick(true)}
          />
          <Button
            title="Hint"
            disabled={showHint}
            onPress={() => showHintClick(true)}
          />
          {game.guesses.length == game.maxGuesses ? <Button title="Share" onPress={onShare} /> : <Text />}
          <Button title="back" onPress={() => onBack(game)} />
        </View>
      </Card>
    </View>
  );
};

const onShare = async () => {
    try {
      await Share.share({
        message:""+share,
      });
    } catch (error) {
      console.error(error)
    }
  };
// the application switches between the two screens, and keep tracks of the statistics
const App = () => {
  // we have a current game, which can be null
  // if game is null show settings screen
  // if game is not null, show the wordle screen
  const [game, setGame] = useState<Wordle | null>(null);
  //const [game, setGame] = useState<Wordle|null>(testGame)

  // we keep track of the statistics
  const [stats, setStats] = useState<number[]>([]);
  getData(setStats);

  // this callback is passed down to the settings screen
  // the settings screen builds a game, and we set it here
  const startPlaying = (game: Wordle) => setGame(game);

  // this causes the wordle screen to stop being rendered
  // since it sets the current game to null
  // then the setting screen will be rendered
  const stopPlaying = () => setGame(null);


  //sample statistics
  if(stats.length===0){
    setStats([0,6,7,2,3,4,6,5,6])
  }
  

  // this callbacks ends the game, and collects the statistics if necessary
  const getStats = (game: Wordle) => {
    // status is defined in wordle.ts, from assignment 1
    switch (status(game)) {
      case 'next':
        break;
      case 'lost':
        setStats([...stats, 7]);
        break;
      case 'win':
        setStats([...stats, game.guesses.length]);
        break;
    }
    stopPlaying();
    setData(stats);
  };

  return game === null ? (
    <Settings onStart={startPlaying} statistics={stats} />
  ) : (
    <WordleGame onBack={getStats} startGame={game} />
  );
};
//TODO Persistence (1 pts)
const setData = async (stats: number[]) => {
  try {
    const jsonValue = JSON.stringify(stats);
    await AsyncStorage.setItem('stats', jsonValue);
  } catch (e) {
    // saving error
    console.error(e);
  }
  console.log('updated the statistics with: ' + stats);
};

const getData = async (
  setStats: React.Dispatch<React.SetStateAction<number[]>>
) => {
  try {
    const jsonValue = await AsyncStorage.getItem('stats');
    jsonValue != null ? setStats(JSON.parse(jsonValue)) : setStats([]);
  } catch (e) {
    // error reading value
    console.error(e);
  }
};

type EmojiProps = {
  label?: string;
  symbol: symbol;
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
    padding: 8,
  },
  row: {
    flexDirection: 'row',
  },
  centered: {
    justifyContent: 'center',
  },
  card: {
    margin: 10,
    padding: 8,
  },
  paragraph: {
    margin: 24,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  boardCell: {
    flex: 1,
    borderColor: 'black',
    borderWidth: 1,
    margin: 2,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  key: {
    flex: 1,
    borderColor: 'black',
    borderWidth: 1,
    margin: 2,
    width: 30,
    height: 40,
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  correct: {
    backgroundColor: 'green',
  },
  misplaced: {
    backgroundColor: 'yellow',
  },
  absent: {
    backgroundColor: 'red',
  },
  untried: {
    backgroundColor: 'grey',
  },
  bordered: { borderColor: 'black', borderWidth: 1 },
  textField: { width: 80 },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    alignItems: 'stretch',
  },
});

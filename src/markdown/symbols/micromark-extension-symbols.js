import assert from 'assert';

export default symbols;

function symbols(codes) {
    const validCodes = codes.toLowerCase();
    const symbol = {
        tokenize: tokenizeSymbol,
    };

    return {
        text: {
            123: symbol
        }
    };

    function tokenizeSymbol(effects, ok, nok) {
        return start;

        function start(code) {
            assert(code === 123, 'expected `{`');
            effects.enter('symbol');
            effects.enter('symbolStartMarker');
            effects.consume(code);
            effects.exit('symbolStartMarker');
            return open;
        }

        function open(code) {
            if (code < 0) {
                return nok(code);
            }

            const c = String.fromCharCode(code).toLowerCase();

            if (validCodes.includes(c)) {
                effects.enter('symbolValue');
                effects.consume(code);
                return more;
            }
            
            return nok(code);
        }

        function more(code) {
            if (code === 125) { // '}'
                effects.exit('symbolValue');
                effects.enter('symbolEndMarker');
                effects.consume(code);
                effects.exit('symbolEndMarker');
                effects.exit('symbol');
                return ok;
            }

            if (code < 0) {
                return nok(code);
            }

            const c = String.fromCharCode(code).toLowerCase();
            if (validCodes.includes(c)) {
                effects.consume(code);
                return more;
            }

            return nok(code);
        }
    }
}
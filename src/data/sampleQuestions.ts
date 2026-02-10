export const sampleQuestions = [
    {
        id: "gate_2024_cse_01",
        title: "Probability of Coin Toss",
        question_html: "<p>Consider a fair coin that is tossed <strong>n</strong> times. The probability that the number of heads is at least 1 is:</p> $$ P(H \\ge 1) = 1 - P(H=0) $$",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "$$ 1 - (1/2)^n $$", is_correct: true },
            { label: "B", text_html: "$$ (1/2)^n $$", is_correct: false },
            { label: "C", text_html: "$$ 1 - 1/n $$", is_correct: false },
            { label: "D", text_html: "$$ 1/n $$", is_correct: false }
        ],
        branch: "cse",
        subject: "Engineering Mathematics",
        topic: "Probability",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_cse_02",
        title: "Time Complexity Analysis",
        question_html: "<p>What is the time complexity of the following recurrence relation?</p> $$ T(n) = 2T(n/2) + n $$",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "$$ O(n) $$", is_correct: false },
            { label: "B", text_html: "$$ O(n \\log n) $$", is_correct: true },
            { label: "C", text_html: "$$ O(n^2) $$", is_correct: false },
            { label: "D", text_html: "$$ O(\\log n) $$", is_correct: false }
        ],
        branch: "cse",
        subject: "Algorithms",
        topic: "Recurrence Relations",
        year: "2024",
        marks: 2
    },
    {
        id: "gate_2024_cse_03",
        title: "Eigen Values",
        question_html: "<p>The sum of the eigenvalues of the matrix <strong>M</strong> is:</p> $$ M = \\begin{bmatrix} 2 & 1 \\\\ 1 & 3 \\end{bmatrix} $$",
        question_type: "nat",
        nat_answer_min: "5",
        nat_answer_max: "5",
        branch: "cse",
        subject: "Engineering Mathematics",
        topic: "Linear Algebra",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_ece_01",
        title: "Op-Amp Circuit",
        question_html: "<p>In the following ideal Op-Amp circuit, if $$ V_{in} = 2V $$, what is $$ V_{out} $$?</p>",
        question_type: "nat",
        nat_answer_min: "-4",
        nat_answer_max: "-4",
        branch: "ece",
        subject: "Analog Circuits",
        topic: "Operational Amplifiers",
        year: "2024",
        marks: 2
    },
    {
        id: "gate_2024_ece_02",
        title: "Digital Logic",
        question_html: "<p>The boolean function $$ F(A,B,C) = \\sum m(0, 2, 4, 6) $$ simplifies to:</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "$$ C' $$", is_correct: true },
            { label: "B", text_html: "$$ B' $$", is_correct: false },
            { label: "C", text_html: "$$ A' $$", is_correct: false },
            { label: "D", text_html: "$$ C $$", is_correct: false }
        ],
        branch: "ece",
        subject: "Digital Circuits",
        topic: "K-Maps",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_ga_01",
        title: "Verbal Ability",
        question_html: "<p>Select the word that fits best: 'The judge was known for his ______ decision making.'</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "Biased", is_correct: false },
            { label: "B", text_html: "Impartial", is_correct: true },
            { label: "C", text_html: "Reluctant", is_correct: false },
            { label: "D", text_html: "Hasty", is_correct: false }
        ],
        branch: "general",
        subject: "General Aptitude",
        topic: "Verbal",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_ga_02",
        title: "Numerical Ability",
        question_html: "<p>If $$ 2^x = 32 $$ and $$ 3^y = 27 $$, what is $$ x+y $$?</p>",
        question_type: "nat",
        nat_answer_min: "8",
        nat_answer_max: "8",
        branch: "general",
        subject: "General Aptitude",
        topic: "Numerical",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_cse_04",
        title: "Computer Networks",
        question_html: "<p>A TCP segment has a sequence number of 1000 and a payload size of 500 bytes. What is the sequence number of the next segment?</p>",
        question_type: "nat",
        nat_answer_min: "1500",
        nat_answer_max: "1500",
        branch: "cse",
        subject: "Computer Networks",
        topic: "TCP/IP",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_cse_05",
        title: "Database Normalization",
        question_html: "<p>Which normal form disallows transitive dependencies?</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "1NF", is_correct: false },
            { label: "B", text_html: "2NF", is_correct: false },
            { label: "C", text_html: "3NF", is_correct: true },
            { label: "D", text_html: "BCNF", is_correct: false }
        ],
        branch: "cse",
        subject: "DBMS",
        topic: "Normalization",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_cse_06",
        title: "Operating Systems",
        question_html: "<p>Which scheduling algorithm results in the minimum average waiting time?</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "FCFS", is_correct: false },
            { label: "B", text_html: "Round Robin", is_correct: false },
            { label: "C", text_html: "SJF (Shortest Job First)", is_correct: true },
            { label: "D", text_html: "Priority", is_correct: false }
        ],
        branch: "cse",
        subject: "Operating Systems",
        topic: "Scheduling",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_me_01",
        title: "Thermodynamics",
        question_html: "<p>For an ideal gas, the change in internal energy $$ \\Delta U $$ depends only on:</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "Pressure", is_correct: false },
            { label: "B", text_html: "Volume", is_correct: false },
            { label: "C", text_html: "Temperature", is_correct: true },
            { label: "D", text_html: "Entropy", is_correct: false }
        ],
        branch: "me",
        subject: "Thermodynamics",
        topic: "Basics",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_ga_03",
        title: "Logical Reasoning",
        question_html: "<p>In a certain code language, if 'TIGER' is written as 'QDFHS', then how is 'FISH' written in that code?</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "CHR G", is_correct: true },
            { label: "B", text_html: "GERH", is_correct: false },
            { label: "C", text_html: "GRHE", is_correct: false },
            { label: "D", text_html: "GREH", is_correct: false }
        ],
        branch: "general",
        subject: "General Aptitude",
        topic: "Reasoning",
        year: "2024",
        marks: 2
    },
    {
        id: "gate_2024_ga_04",
        title: "Data Interpretation",
        question_html: "<p>The pie chart shows the breakdown of a company's expenses. If the total expense is $100,000 and 'Marketing' takes up 15%, how much is spent on Marketing?</p>",
        question_type: "nat",
        nat_answer_min: "15000",
        nat_answer_max: "15000",
        branch: "general",
        subject: "General Aptitude",
        topic: "Data Interpretation",
        year: "2024",
        marks: 2
    },
    {
        id: "gate_2024_cse_07",
        title: "Compiler Design",
        question_html: "<p>Which of the following creates the symbol table?</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "Lexical Analyzer", is_correct: false },
            { label: "B", text_html: "Syntax Analyzer", is_correct: false },
            { label: "C", text_html: "Semantic Analyzer", is_correct: true },
            { label: "D", text_html: "Code Generator", is_correct: false }
        ],
        branch: "cse",
        subject: "Compiler Design",
        topic: "Symbol Table",
        year: "2024",
        marks: 1
    },
    {
        id: "gate_2024_cse_08",
        title: "Theory of Computation",
        question_html: "<p>What is the language accepted by the following DFA where S is start state and F is final state?</p>",
        question_type: "mcq",
        options: [
            { label: "A", text_html: "Strings ending with 00", is_correct: false },
            { label: "B", text_html: "Strings ending with 11", is_correct: false },
            { label: "C", text_html: "Strings with odd number of 1s", is_correct: true },
            { label: "D", text_html: "Strings with even number of 0s", is_correct: false }
        ],
        branch: "cse",
        subject: "Theory of Computation",
        topic: "DFA",
        year: "2024",
        marks: 2
    }
];

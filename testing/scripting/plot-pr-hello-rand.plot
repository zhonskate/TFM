# Scale font and line width (dpi) by changing the size! It will always display stretched.
set terminal svg size 600,500 enhanced fname 'arial' 
set term png medium background '#ffffff'
set output '../output/pr-hello-rand-full.png'

# Key means label...
set key inside top left
#set logscale x
#set logscale y
set ylabel 'time(s)'
set ytics nomirror
#set y2tics 1 nomirror 
#set y2label 'replicas' 
set yrange [-5:8]
set xrange [0:1000]
set xlabel 'calls'
set title '0.1-0.4 second interval'
plot  "../input/f-pr-hello-rand.txt" using (($1)):(($3)/1000) lc rgb '#1B9E77' title 'queue time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(181.469/1000) lw 2 lc rgb '#1B9E77' notitle 'avg queue time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(($4-$3)/1000) lc rgb '#D95F02' title 'runtime load time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(320.933/1000) lw 2 lc rgb '#D95F02' notitle 'avg runtime load time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(($5-$3)/1000) lc rgb '#7570B3' title 'function load time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(1580.94/1000) lw 2 lc rgb '#7570B3' notitle 'avg function load time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(($6-$3)/1000) lc rgb '#E7298A' title 'exec time' with lines, \
"../input/f-pr-hello-rand.txt" using (($1)):(2927.25/1000) lw 2 lc rgb '#E7298A' notitle 'avg exec time' with lines
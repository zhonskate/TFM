# Scale font and line width (dpi) by changing the size! It will always display stretched.
set terminal svg size 600,500 enhanced fname 'arial' 
set term png medium background '#ffffff'
set output '../output/pf-hello-025.png'

# Key means label...
set key inside top left
#set logscale x
#set logscale y
set ylabel 'time(s)'
set ytics nomirror
#set y2tics 1 nomirror 
#set y2label 'replicas' 
set yrange [-10:]
set xrange [0:1000]
set xlabel 'calls'
set title '0.25 second interval'
plot  "../input/f-pf-hello-025.txt" using (($1)-10):(($3)/1000) lc rgb '#1B9E77' title 'queue time' with lines, \
"../input/f-pf-hello-025.txt" using (($1)-10):(-1072.63/1000) lw 2 lc rgb '#D95F02' notitle 'avg runtime load time' with lines, \
"../input/f-pf-hello-025.txt" using (($1)-10):(($5-$3)/1000) lc rgb '#7570B3' title 'function load time' with lines, \
"../input/f-pf-hello-025.txt" using (($1)-10):(-1070.99/1000) lw 2 lc rgb '#7570B3' notitle 'avg function load time' with lines, \
"../input/f-pf-hello-025.txt" using (($1)-10):(($6-$3)/1000) lc rgb '#E7298A' title 'exec time' with lines, \
"../input/f-pf-hello-025.txt" using (($1)-10):(1315.95/1000) lw 2 lc rgb '#E7298A' notitle 'avg exec time' with lines
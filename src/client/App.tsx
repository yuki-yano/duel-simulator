import { Card, CardContent } from "@client/components/Card"
import { GameField } from "@client/components/GameField"

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-center mb-4 sm:mb-8">Duel Simulator</h1>
        <Card className="max-w-7xl mx-auto">
          {/* <CardHeader>                                                        */}
          {/*   <CardTitle className="text-lg sm:text-2xl">Game Field</CardTitle> */}
          {/* </CardHeader>                                                       */}
          <CardContent>
            <GameField />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
